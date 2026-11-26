import { jsPDF } from 'jspdf'
import { WA, money, itemsOf } from './firebase'

export function buildPDF(o) {
  const d = new jsPDF(), items = itemsOf(o)
  d.setFillColor(0, 0, 0); d.rect(0, 0, 210, 36, 'F')
  d.setTextColor(255, 143, 166); d.setFontSize(26); d.setFont('times', 'bold'); d.text('ELORA', 14, 22)
  d.setTextColor(255); d.setFontSize(11); d.setFont('helvetica', 'normal'); d.text('ORDER RECEIPT', 196, 22, { align: 'right' })
  d.setTextColor(0); d.setFontSize(11)
  let y = 50
  const line = (k, v) => { d.setFont('helvetica', 'bold'); d.text(k, 14, y); d.setFont('helvetica', 'normal'); d.text(String(v), 60, y, { maxWidth: 135 }); y += 9 }
  line('Order No:', o.orderNo); line('Date:', o.date); y += 4
  line('Name:', o.name); line('Address:', o.address); if (o.address.length > 60) y += 9
  line('Phone 1:', o.phone1); line('Phone 2:', o.phone2); line('Nearest Town:', o.town)
  if (o.note) line('Note:', o.note)
  if (o.giftBox) { line('Gift Box:', 'YES - please pack as a gift' + (o.giftFee > 0 ? ' (' + money(o.giftFee) + ')' : '')); if (o.giftMsg) line('Gift Message:', o.giftMsg) }
  y += 2; d.setDrawColor(255, 143, 166); d.line(14, y, 196, y); y += 8
  d.setFont('helvetica', 'bold'); d.text('Item', 14, y); d.text('Size', 110, y); d.text('Qty', 130, y); d.text('Price', 150, y); d.text('Total', 196, y, { align: 'right' }); y += 8
  d.setFont('helvetica', 'normal')
  items.forEach(it => {
    if (y > 260) { d.addPage(); y = 20 }
    d.text(String(it.name), 14, y, { maxWidth: 90 }); d.text(it.size || '-', 110, y); d.text(String(it.qty), 130, y)
    d.text(money(it.price), 150, y); d.text(money(it.price * it.qty), 196, y, { align: 'right' }); y += 9
  })
  d.line(14, y, 196, y); y += 9
  const sub = o.subtotal ?? items.reduce((t, it) => t + it.price * it.qty, 0)
  d.setFontSize(11); d.setFont('helvetica', 'normal')
  d.text('Subtotal: ' + money(sub), 196, y, { align: 'right' }); y += 8
  if (o.discount > 0) { d.text('Discount' + (o.offers?.length ? ' (' + o.offers.join(', ') + ')' : '') + ': - ' + money(o.discount), 196, y, { align: 'right', maxWidth: 170 }); y += 8 }
  if (o.delivery != null) { d.text('Delivery: ' + (o.delivery === 0 ? 'FREE' : money(o.delivery)), 196, y, { align: 'right' }); y += 8 }
  if (o.giftBox) { d.text('Gift Box: ' + (o.giftFee > 0 ? money(o.giftFee) : 'FREE'), 196, y, { align: 'right' }); y += 8 }
  y += 2
  d.setFontSize(14); d.setTextColor(184, 58, 85); d.setFont('helvetica', 'bold'); d.text('TOTAL: ' + money(o.total), 196, y, { align: 'right' })
  d.setTextColor(120); d.setFontSize(10); d.setFont('helvetica', 'normal')
  d.text('Thank you for shopping with ELORA!  WhatsApp: 0774071805', 105, 285, { align: 'center' })
  return d
}
export const downloadPDF = o => buildPDF(o).save(`ELORA-${o.orderNo}.pdf`)

export function ownerWA(o) {
  const sub = o.subtotal ?? itemsOf(o).reduce((t, it) => t + it.price * it.qty, 0)
  const list = itemsOf(o).map((it, i) => `${i + 1}. ${it.name}${it.size ? ' (Size ' + it.size + ')' : ''} × ${it.qty} = ${money(it.price * it.qty)}`).join('\n')
  const m = `🛍️ *ELORA – New Order*\n*Order No:* ${o.orderNo}\n*Date:* ${o.date}\n\n*Name:* ${o.name}\n*Address:* ${o.address}\n*Phone 1:* ${o.phone1}\n*Phone 2:* ${o.phone2}\n*Nearest Town:* ${o.town}${o.note ? '\n*Note:* ' + o.note : ''}${o.giftBox ? '\n🎁 *GIFT BOX: YES*' + (o.giftMsg ? ' – "' + o.giftMsg + '"' : '') : ''}\n\n*Items:*\n${list}\n\n*Subtotal:* ${money(sub)}${o.discount > 0 ? '\n*Discount:* - ' + money(o.discount) : ''}${o.delivery != null ? '\n*Delivery:* ' + (o.delivery === 0 ? 'FREE' : money(o.delivery)) : ''}${o.giftBox && o.giftFee > 0 ? '\n*Gift box:* ' + money(o.giftFee) : ''}\n*Total:* ${money(o.total)}\n\n(Receipt PDF attached)`
  return `https://wa.me/${WA}?text=${encodeURIComponent(m)}`
}
