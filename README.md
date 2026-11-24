# ELORA

1. src/firebase.js eke firebaseConfig replace karanna
2. npm install
3. npm run dev   ->  http://localhost:5173  (shop)   http://localhost:5173/admin.html  (admin)
4. npm run build -> dist/ folder eka Firebase Hosting / Netlify / Vercel ekata upload

Firestore rules:
rules_version = '2';
service cloud.firestore { match /databases/{db}/documents {
  match /products/{id} { allow read: if true; allow write: if request.auth != null; }
  match /orders/{id} { allow create: if true; allow read, update, delete: if request.auth != null; }
}}
