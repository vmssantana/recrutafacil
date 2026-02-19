// js/supabaseClient.js
const SUPABASE_URL = "https://axnezeiyxwsgrgoiiyqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bmV6ZWl5eHdzZ3Jnb2lpeXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODk3MzMsImV4cCI6MjA4NzA2NTczM30.ZQ0JCKLddSSiszXN-dG92p2Q9K9Dw5f7ACvRDzX5o5Q";

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
