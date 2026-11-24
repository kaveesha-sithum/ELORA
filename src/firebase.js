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

// ---- offers ----
export function offerText(o) {
  const c = []
  if (o.minQty) c.push(`buy ${o.minQty} or more items`)
  if (o.minTotal) c.push(`spend Rs. ${Number(o.minTotal).toLocaleString('en-LK')} or more`)
  const benefit = o.type === 'freeDelivery' ? 'FREE delivery' : `${o.percent}% OFF`
  return c.length ? `${benefit} when you ${c.join(' and ')}` : `${benefit} on every order`
}
export function calcOffers(offers, qty, sub, base) {
  const act = offers.filter(o => o.active !== false)
  const met = o => qty >= (o.minQty || 0) && sub >= (o.minTotal || 0)
  const name = o => o.title || offerText(o)
  const fdMet = act.find(o => o.type === 'freeDelivery' && met(o))
  let best = null
  act.forEach(o => { if (o.type === 'percent' && met(o) && (!best || o.percent > best.percent)) best = o })
  const applied = [], discount = best ? Math.round(sub * best.percent / 100) : 0
  if (fdMet) applied.push(name(fdMet)); if (best) applied.push(name(best))
  const hints = qty <= 0 ? [] : act.filter(o => !met(o) && !(o.type === 'freeDelivery' && fdMet) && !(o.type === 'percent' && best && best.percent >= o.percent)).slice(0, 2).map(o => {
    const p = []
    if (o.minQty && qty < o.minQty) p.push(`add ${o.minQty - qty} more item${o.minQty - qty > 1 ? 's' : ''}`)
    if (o.minTotal && sub < o.minTotal) p.push(`spend Rs. ${(o.minTotal - sub).toLocaleString('en-LK')} more`)
    const t = p.join(' and ')
    return `${t[0].toUpperCase() + t.slice(1)} to get ${o.type === 'freeDelivery' ? 'FREE delivery' : o.percent + '% OFF'}!`
  })
  return { delivery: fdMet ? 0 : base, discount, applied, hints }
}
