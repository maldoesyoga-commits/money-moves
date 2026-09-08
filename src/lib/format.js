export function formatMoney(amount) {
  return (Number(amount) || 0).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
  })
}
