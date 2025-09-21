# WareOps - Warehouse Operations Management System

A modern warehouse management application built with Next.js 15.3.3, Firebase, and TypeScript. WareOps provides comprehensive tools for managing shipments, inventory, analytics, and warehouse operations.

## 🚀 Features

- **Shipment Management** - Track and manage warehouse shipments
- **Inventory Control** - Real-time inventory tracking and management
- **Analytics Dashboard** - Comprehensive analytics and reporting
- **Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **Firebase Integration** - Real-time database and authentication
- **Responsive Design** - Mobile-friendly interface
- **TypeScript** - Full type safety and better development experience

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.3, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Authentication)
- **Development**: Turbopack for fast development builds

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Git**

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/asif1001/wareopes1.git
cd wareopes1
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Get your Firebase configuration from Project Settings
4. Create a `.env` file in the root directory:

```env
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here
```

### 4. Set up Firestore Collections

Create the following collections in your Firestore database:
- `shipments` - For shipment data
- `inventory` - For inventory items
- `analytics` - For analytics data
- `users` - For user management

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 📜 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code linting

## 🔧 Environment Variables

Create a `.env` file with the following variables:

| Variable | Description |
|----------|-------------|
| `FIREBASE_API_KEY` | Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `FIREBASE_APP_ID` | Firebase app ID |

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory
├── components/          # Reusable UI components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
│   ├── firebase/       # Firebase configuration and utilities
│   ├── types.ts        # TypeScript type definitions
│   └── utils.ts        # General utility functions
└── ai/                 # AI-related functionality
```

## 🔒 Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already included in `.gitignore`
- Use environment variables for all sensitive configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Firebase Connection Issues
- Ensure your Firebase configuration is correct in the `.env` file
- Check that Firestore is enabled in your Firebase project
- Verify that your Firebase project ID matches the one in `.firebaserc`

### Development Server Issues
- Make sure you're using Node.js version 18 or higher
- Clear the `.next` cache: `rm -rf .next` (or `rmdir /s .next` on Windows)
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Firebase
