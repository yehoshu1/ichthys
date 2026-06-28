const clientId = "1427262939840118946";
const clientSecret = "1F4FgRFJKUyOjUysl6PgvAtHpzjNdInD";

const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

fetch('https://discord.com/api/oauth2/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'identify'
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
