// Example configuration file
// Copy this to config.js and fill in your actual values

module.exports = {
  // Firebase Configuration
  firebase: {
    privateKeyId: 'your_private_key_id_here',
    privateKey: '-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n',
    clientEmail: 'firebase-adminsdk-xxxxx@cellulai.iam.gserviceaccount.com',
    clientId: 'your_client_id_here'
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: 'your_openai_api_key_here',
    baseUrl: 'https://api.openai.com/v1'
  },
  
  // Server Configuration
  server: {
    port: 3000,
    environment: 'development'
  }
};



