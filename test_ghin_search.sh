#!/bin/bash
# Hits ghin-name-search-test edge fn. Replace YOUR_PASSWORD with current GHIN password.
# Output saved to ~/Desktop/ghin_test_result.json

curl -s -X POST 'https://mhzhdmsiliyfnijzddhu.supabase.co/functions/v1/ghin-name-search-test' \
  -H 'Content-Type: application/json' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oemhkbXNpbGl5Zm5panpkZGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQyODcsImV4cCI6MjA5MTQyMDI4N30.dKdXusJw_YqNtd5WEKm_qDyXbdfnKUGkxfDHBhXur3M' \
  -d '{"ghin_number":"1321498","password":"YOUR_PASSWORD"}' \
  | tee ~/Desktop/ghin_test_result.json
echo ""
echo "---DONE--- saved to ~/Desktop/ghin_test_result.json"
