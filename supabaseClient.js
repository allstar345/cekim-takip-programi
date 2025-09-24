import { createClient } from '@supabase/supabase-js'

// Gönderdiğin bilgilerle senin için doldurdum.
// Doğrudan kopyalayıp kullanabilirsin.
const supabaseUrl = 'https://rwpwbugrhpwhpfblinua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cHdidWdyaHB3aHBmYmxpbnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY5NDQ3MDQsImV4cCI6MjA0MjUyMDcwNH0.JjE1256b-3-Y-eU9Vb_Yj_0Zc_h_M0P8P2a5Q8k1F_M';

export const supabase = createClient(supabaseUrl, supabaseKey);
