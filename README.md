# Synoza — AI-Powered OSCE Medical Training Platform

Synoza is a full-stack web platform for medical students to practice OSCE clinical stations with AI simulated patients and automated examiners.

## Tech Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS 4
- **Backend:** Node.js + Express + TypeScript
- **Database:** MySQL 8+ (Prisma ORM)
- **AI:** OpenAI integration with mock/demo mode for development

## Features

### Student Portal
- Register / Login / Password reset
- Profile management
- Browse & search clinical stations
- AI patient chat simulation (AR/EN)
- Examiner VIVA box
- Automated scoring & feedback
- Personal statistics & results history
- Connection ping indicator

### Admin Dashboard
- User management & roles
- Case management
- Specialties & difficulty levels
- AI settings
- Results & analytics
- Subscriptions & audit logs

### Doctor Portal
- View cases & student results
- Analytics overview

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env
cp .env server/.env

# 2. Create MySQL database (needs MySQL root password)
powershell -ExecutionPolicy Bypass -File server/scripts/setup-mysql.ps1 -RootPassword "YOUR_MYSQL_ROOT_PASSWORD"

# 3. Install & migrate
npm install
npm install --prefix server
npm install --prefix client
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start development
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Default Accounts

| Role    | Email               | Password        |
|---------|---------------------|-----------------|
| Admin   | admin@synoza.com    | Admin@123456    |
| Doctor  | doctor@synoza.com   | Doctor@123456   |
| Student | student@synoza.com  | Student@123456  |

## AI Configuration

By default, the platform runs in **mock mode** (no API key needed).

To enable real AI:
1. Set `AI_PROVIDER=openai` in `.env`
2. Add your `OPENAI_API_KEY`
3. Or configure via Admin Dashboard → AI Settings

## Contact

Phone: **01024828652**

## Partner Universities

Misr University for Science and Technology, 6th October, Ain Shams, Al-Azhar, Benha, Cairo, Fayoum, Galala, Mansoura, MTI, Nahda, Alexandria

## Project Structure

```
Synoza/
├── client/          # React frontend
├── server/          # Express API + Prisma
├── .env.example     # Environment template
└── package.json     # Root scripts
```

## Production Build

```bash
npm run build
npm start
```

The server serves the built React app and API from a single port.

## Security

- bcrypt password hashing
- JWT authentication
- Helmet security headers
- Rate limiting
- Role-based access control
- Input validation

## License

Proprietary — Synoza Platform
