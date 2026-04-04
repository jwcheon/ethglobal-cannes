import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MerchantPOS from './MerchantPOS'
import Listener from './Listener'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Listener />} />
        <Route path="/merchant" element={<MerchantPOS />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
