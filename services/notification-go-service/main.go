package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/streadway/amqp"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for demo
	},
}

// Client represents a connected WebSocket client
type Client struct {
	conn *websocket.Conn
	send chan []byte
}

var (
	clients   = make(map[*Client]bool)
	broadcast = make(chan []byte)
	mutex     = &sync.Mutex{}
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, `{"status": "Notification Service is running"}`)
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade Error: %v", err)
		return
	}
	defer ws.Close()

	client := &Client{conn: ws, send: make(chan []byte, 256)}
	
	mutex.Lock()
	clients[client] = true
	mutex.Unlock()

	// Handle disconnect
	defer func() {
		mutex.Lock()
		delete(clients, client)
		close(client.send)
		mutex.Unlock()
	}()

	// Read messages (ping/pong handling could go here)
	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			break
		}
	}
}

func handleMessages() {
	for {
		// Grab the next message from the broadcast channel
		msg := <-broadcast
		
		mutex.Lock()
		for client := range clients {
			err := client.conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Printf("WebSocket Write Error: %v", err)
				client.conn.Close()
				delete(clients, client)
			}
		}
		mutex.Unlock()
	}
}

func setupRabbitMQConsumer() {
	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://guest:guest@rabbitmq:5672/"
	}

	var conn *amqp.Connection
	var err error

	// Retry connection
	for i := 0; i < 5; i++ {
		conn, err = amqp.Dial(rabbitURL)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to RabbitMQ, retrying... (%v)", err)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Printf("Could not connect to RabbitMQ: %v", err)
		return
	}
	// Do not close connection if we want it to run indefinitely, but typically handled properly.

	ch, err := conn.Channel()
	if err != nil {
		log.Printf("Failed to open a channel: %v", err)
		return
	}

	q, err := ch.QueueDeclare(
		"notifications", // name
		true,            // durable
		false,           // delete when unused
		false,           // exclusive
		false,           // no-wait
		nil,             // arguments
	)
	if err != nil {
		log.Printf("Failed to declare a queue: %v", err)
		return
	}

	msgs, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		true,   // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)
	if err != nil {
		log.Printf("Failed to register a consumer: %v", err)
		return
	}

	log.Println("Waiting for messages from RabbitMQ...")
	for d := range msgs {
		log.Printf("Received a message: %s", d.Body)
		
		// Send to WebSocket connected clients
		msgWrapper := map[string]interface{}{
			"type": "notification",
			"data": string(d.Body),
			"timestamp": time.Now().Format(time.RFC3339),
		}
		jsonMsg, _ := json.Marshal(msgWrapper)
		broadcast <- jsonMsg
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8004"
	}

	go handleMessages()
	go setupRabbitMQConsumer()

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ws", handleConnections)

	log.Printf("Notification Service listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
