import Subscriptions from './Subscriptions'
import Categories from './Categories'
import Receipts from './Receipts'

function More() {
  return (
    <section className="more">
      <h1>More</h1>
      <Subscriptions />
      <Categories />
      <Receipts />
    </section>
  )
}

export default More
