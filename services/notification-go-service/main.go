package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/streadway/amqp"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost:3000"
		}
		for _, o := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(o) == origin {
				return true
			}
		}
		return origin == ""
	},
}

// Client represents a connected WebSocket client
type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	tenantID string
}

type BroadcastMessage struct {
	TenantID string
	Payload  []byte
}

var (
	clients   = make(map[*Client]bool)
	broadcast = make(chan BroadcastMessage)
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

	tenantID := r.URL.Query().Get("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	client := &Client{conn: ws, send: make(chan []byte, 256), tenantID: tenantID}
	
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
			if client.tenantID == msg.TenantID {
				err := client.conn.WriteMessage(websocket.TextMessage, msg.Payload)
				if err != nil {
					log.Printf("WebSocket Write Error: %v", err)
					client.conn.Close()
					delete(clients, client)
				}
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

	err = ch.ExchangeDeclare(
		"notifications_exchange", // name
		"fanout",                 // type
		true,                     // durable
		false,                    // auto-deleted
		false,                    // internal
		false,                    // no-wait
		nil,                      // arguments
	)
	if err != nil {
		log.Printf("Failed to declare an exchange: %v", err)
		return
	}

	q, err := ch.QueueDeclare(
		"",    // empty name generates a unique temporary queue name
		false, // non-durable
		false, // delete when unused
		true,  // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		log.Printf("Failed to declare a queue: %v", err)
		return
	}

	err = ch.QueueBind(
		q.Name,
		"", // routing key
		"notifications_exchange",
		false,
		nil,
	)
	if err != nil {
		log.Printf("Failed to bind queue: %v", err)
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
		var rawData map[string]interface{}
		json.Unmarshal(d.Body, &rawData)
		
		tenantID := "default"
		if val, ok := rawData["tenant_id"].(string); ok {
			tenantID = val
		}

		msgWrapper := map[string]interface{}{
			"type": "notification",
			"data": string(d.Body),
			"timestamp": time.Now().Format(time.RFC3339),
		}
		jsonMsg, _ := json.Marshal(msgWrapper)
		broadcast <- BroadcastMessage{TenantID: tenantID, Payload: jsonMsg}
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
