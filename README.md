# 📊 GPT Cells - AI-Powered Spreadsheet Platform

A modern spreadsheet application with AI-powered content generation supporting text, image, and audio generation with persistent storage.

## 🚀 Live Demo

- **Frontend**: https://cellulai.web.app
- **Admin Panel**: https://cellulai.web.app/admin.html
- **Login**: https://cellulai.web.app/login.html

## ✨ Features

- **🤖 AI Content Generation**: Generate text, images, and audio using OpenAI's latest models
- **📊 Smart Spreadsheets**: Create intelligent spreadsheets with automatic content generation
- **☁️ Cloud Storage**: All data securely stored in Firebase with automatic sync
- **👥 User Management**: Secure authentication with Google OAuth and email/password
- **🔒 Secure & Private**: Enterprise-grade security with user data isolation
- **⚡ Real-time Updates**: Live collaboration with real-time updates and dependency resolution
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3/JavaScript** - Modern web standards
- **Firebase Hosting** - Static file hosting
- **Firebase Auth** - User authentication
- **Firebase Firestore** - Real-time database

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **Firebase Admin SDK** - Server-side Firebase integration
- **OpenRouter API** - AI text generation
- **Fal.ai API** - AI image generation

### Deployment
- **Firebase Hosting** - Frontend deployment
- **Railway** - Backend deployment
- **GitHub** - Version control and CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- Railway account
- OpenRouter API key
- Fal.ai API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gpt-cells-app.git
   cd gpt-cells-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🚂 Deployment

### Frontend (Firebase Hosting)
```bash
firebase deploy --only hosting
```

### Backend (Railway)
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on every push

### Environment Variables
- `NODE_ENV=production`
- `OPENROUTER_API_KEY=your-openrouter-key`
- `FAL_AI_API_KEY=your-fal-ai-key`

## 📁 Project Structure

```
gpt-cells-app/
├── public/                 # Frontend files
│   ├── app.html           # Main application
│   ├── script.js          # Frontend logic
│   ├── admin.html         # Admin panel
│   ├── login.html         # Authentication
│   └── firebase-config.js # Firebase configuration
├── server.js              # Backend server
├── package.json           # Dependencies
├── railway.json           # Railway configuration
└── README.md             # This file
```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Authentication (Google + Email/Password)
3. Enable Firestore Database
4. Configure Firebase Hosting
5. Add your domain to authorized domains

### API Keys Setup
1. **OpenRouter**: Get API key from https://openrouter.ai
2. **Fal.ai**: Get API key from https://fal.ai
3. **Set in Railway dashboard** or local `.env` file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT models
- Fal.ai for image generation
- Firebase for backend services
- Railway for deployment platform

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/gpt-cells-app/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/gpt-cells-app/wiki)
- **Email**: support@gptcells.com

---

Built with ❤️ using modern web technologies
