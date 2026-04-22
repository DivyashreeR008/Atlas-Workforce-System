package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, `{"status": "Notification Service is running"}`)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8004"
	}

	http.HandleFunc("/health", healthHandler)

	log.Printf("Notification Service listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
