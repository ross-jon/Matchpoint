const { supabase } = require('../utils/supabase/client');

async function testSignUp() {
  const email = `testuser+${Date.now()}@example.com`;
  const password = 'Password123!';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) {
    console.error('Sign up error:', error);
  } else {
    console.log('Sign up data:', data);
  }
}

testSignUp();

