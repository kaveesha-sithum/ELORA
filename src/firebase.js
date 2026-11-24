import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAJe5M21g7BWleqqINuhE-r8aEtdbGa73k',
  authDomain: 'elora-570f3.firebaseapp.com',
  projectId: 'elora-570f3',
  storageBucket: 'elora-570f3.firebasestorage.app',
  messagingSenderId: '497543747615',
  appId: '1:497543747615:web:379a99c49757ad42cf1d2a',
  measurementId: 'G-S0B9GBY7N6'
}
export const WA = '94774071805' // 0774071805
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const money = n => 'Rs. ' + Number(n).toLocaleString('en-LK')

// ---- helpers ----
export const imgsOf = p => (p.images && p.images.length ? p.images : [p.image].filter(Boolean))
export const itemsOf = o => o.items || [{ name: o.productName, price: o.price, qty: o.qty, size: o.size || '', image: o.image }]
export const makeThumb = (src, s = 180) => new Promise(r => {
  const im = new Image()
  im.onload = () => {
    const k = Math.min(1, s / Math.max(im.width, im.height)), c = document.createElement('canvas')
    c.width = im.width * k; c.height = im.height * k
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
    r(c.toDataURL('image/jpeg', 0.65))
  }
  im.onerror = () => r('')
  im.src = src
})