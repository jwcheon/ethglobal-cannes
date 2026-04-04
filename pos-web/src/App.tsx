import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MerchantPOS from './MerchantPOS'
import Listener from './Listener'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MerchantPOS />} />
        <Route path="/customer" element={<Listener />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
