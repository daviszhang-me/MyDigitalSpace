# MyDigitalSpace - Personal Knowledge Hub

A full-stack personal knowledge management system built with Node.js, Express, SQLite, and vanilla JavaScript.

## 🚀 Features

- **User Authentication** - Secure JWT-based authentication
- **Note Management** - Create, read, update, delete notes
- **Categories & Tags** - Organize with categories and custom tags
- **Search & Filter** - Advanced filtering and full-text search
- **Real-time Stats** - Live statistics and analytics
- **Responsive Design** - Works on desktop and mobile
- **Data Export/Import** - Backup and restore capabilities

## 🏗️ Architecture

```
Frontend (Static HTML/JS/CSS) ← → Backend API (Node.js/Express) ← → PostgreSQL Database
```

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

## 🔧 Installation

### 1. Clone & Setup
```bash
cd MyDigitalSpace
```

### 2. Database Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (if not already installed)
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database
createdb knowledgehub

# Or using psql
psql -U postgres
CREATE DATABASE knowledgehub;
\q
```

#### Option B: Docker PostgreSQL
```bash
docker run --name postgres-knowledgehub \
  -e POSTGRES_USER=knowledgehub \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=knowledgehub \
  -p 5432:5432 \
  -d postgres:15

# Wait for container to be ready
docker logs postgres-knowledgehub
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

### 4. Configure Environment (.env file)
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/knowledgehub

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8000
```

### 5. Initialize Database
```bash
# Run database setup
npm run setup-db

# Should see: ✅ Database setup complete!
```

### 6. Start Backend Server
```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start

# Should see: 🚀 KnowledgeHub API Server Started
```

### 7. Start Frontend
```bash
# In the root directory
cd ../
python3 -m http.server 8000

# Visit: http://localhost:8000
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/verify` - Verify JWT token

### Notes
- `GET /api/notes` - Get all notes (with filtering)
- `GET /api/notes/:id` - Get specific note
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/:id/duplicate` - Duplicate note
- `GET /api/notes/stats/summary` - Get statistics

## 📊 Usage Examples

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "confirmPassword": "securepassword"
  }'
```

### Create Note
```bash
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "My First Note",
    "content": "This is the content of my note",
    "category": "ideas",
    "tags": ["important", "personal"]
  }'
```

## 🔄 Data Migration

If you have existing data in localStorage:

### 1. Export from Frontend
```javascript
// Run this in browser console on your current site
const exportData = {
  user: {
    name: 'Your Name',
    email: 'your@email.com'
  },
  notes: JSON.parse(localStorage.getItem('notes') || '[]')
};
console.log(JSON.stringify(exportData, null, 2));
// Copy the output
```

### 2. Import to Database
```bash
# Edit backend/scripts/migrate-data.js with your data
# Then run:
cd backend
npm run migrate
```

## 🚀 Deployment

### Local Development
```bash
# Backend
cd backend && npm run dev

# Frontend
cd ../ && python3 -m http.server 8000
```

### Cloud Deployment

#### Database Options:
- **AWS RDS PostgreSQL** (~$15/month)
- **Google Cloud SQL** (~$17/month)
- **Railway** (~$5/month, includes hosting)
- **DigitalOcean Managed Database** (~$15/month)

#### Backend Hosting:
- **Railway** (easiest, $5/month)
- **Render** (free tier available)
- **AWS Lambda** (serverless)
- **Google Cloud Run** (serverless)

#### Frontend Hosting:
- **Netlify** (free)
- **Vercel** (free)
- **GitHub Pages** (free)
- **Cloudflare Pages** (free)

### Railway Deployment (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add postgresql
railway deploy

# Set environment variables in Railway dashboard
# Deploy frontend to Netlify/Vercel
```

## 🛠️ Development

### Project Structure
```
MyDigitalSpace/
├── backend/                 # Node.js API server
│   ├── config/             # Database configuration
│   ├── middleware/         # Auth, validation middleware
│   ├── routes/             # API endpoints
│   ├── scripts/            # Setup and migration scripts
│   └── server.js           # Main server file
├── database/               # SQL schema
├── index.html             # Frontend application
├── script.js              # Frontend JavaScript
└── README.md              # This file
```

### Adding New Features
1. Update database schema in `database/schema.sql`
2. Add API endpoints in `backend/routes/`
3. Update frontend in `script.js`
4. Test with curl or Postman

### Database Schema Updates
```bash
# After modifying schema.sql
cd backend
npm run setup-db
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Prevent API abuse
- **CORS Protection** - Cross-origin request security
- **SQL Injection Protection** - Parameterized queries
- **Input Validation** - Joi schema validation
- **Helmet Security** - HTTP security headers

## 📈 Performance

- **Connection Pooling** - Efficient database connections
- **Compression** - Gzip response compression
- **Caching** - Optimized queries with indexes
- **Pagination** - Efficient large dataset handling

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL status
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Test connection
psql -U username -d knowledgehub -c "SELECT 1;"
```

### API Server Issues
```bash
# Check logs
npm run dev  # Watch for error messages

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api
```

### Frontend Issues
```bash
# Check browser console for errors
# Verify API_BASE_URL in script.js
# Check CORS settings in backend
```

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review API documentation at `http://localhost:3001/api`
3. Check server logs for error messages

## 🚀 CI/CD Pipeline

This project includes automated deployment to AWS EC2 using GitHub Actions.

### Features:
- ✅ **Automated Deployment** - Push to main branch triggers deployment
- ✅ **Zero-Downtime** - PM2 process management ensures uptime
- ✅ **Environment Management** - Secure production configurations
- ✅ **Health Checks** - Automatic deployment verification
- ✅ **SSL Ready** - Nginx configuration with security headers

### Deployment Status:
- **Instance**: `i-0f4af27f7d4b2ee8d` (ap-southeast-1)
- **URL**: http://13.215.248.109
- **Backend**: Port 3001 (proxied through Nginx)
- **Database**: SQLite for production simplicity

### Monitoring:
- GitHub Actions: [View Deployments](https://github.com/daviszhang-me/MyDigitalSpace/actions)
- Application Health: http://13.215.248.109/health
- API Status: http://13.215.248.109/api

---

**Happy Knowledge Managing! 🧠✨**

# CI/CD Active! 🚀

Automated deployment pipeline is now live and ready for continuous deployment!

## 🔧 Deployment Fix Applied
- ✅ SSH key configuration resolved
- ✅ EC2 instance connectivity verified  
- ✅ Ready for automated deployment retry