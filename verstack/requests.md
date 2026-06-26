OLLAMA Request
curl http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"granite4.1:3b\",\"prompt\":\"System: Extract into JSON with keys: product_name, quantity, destination, timeline_weeks, sample_required, target_price_usd, special_instructions.\\n\\nUser: i need 600 units of cat theething toy.cargo should ship to New York with in 3 weeks and supports pre order sample,target price including shipping 3$.please negeotiate for best possible rate\",\"stream\":false,\"format\":\"json\"}"

api request
curl -X POST http://localhost:3000/api/v1/rfqs/parse -H "Content-Type: application/json" -d "{\"fileData\":\"i need 600 units of cat theething toy.cargo should ship to New York with in 3 weeks and supports pre order sample,target price including shipping 3$.please negeotiate for best possible rate\"}"
{"trackingId":"c7a0a8f8-b52f-4d66-9d73-03240dcfaa9d"}