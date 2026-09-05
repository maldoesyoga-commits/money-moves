export function formatMoney(amount) {
  return (Number(amount) || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}
