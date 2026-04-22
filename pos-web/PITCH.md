# ultrasonic.fyi Pitch Script

## INTRO

Hey everyone. This is ultrasonic.fyi.

ultrasonic.fyi lets you pay with crypto using ultrasonic sound—no QR codes, no Bluetooth, no NFC.

Built on WalletConnect Pay for the payment rails.

Ultrasonic payments. No QRs, no bluetooth.
Just sound you can't even hear.

---

## PROBLEM

QR codes need you to point your camera and get close enough to scan.
NFC needs you to physically tap—and not every phone even has it.
Bluetooth needs pairing, bleeds through walls, and drains battery.

Now imagine:
A busy coffee shop—10 people in line, one cashier. QR code on a tiny screen? Good luck.
A street vendor—you're 2 meters away, their terminal is small. Can't scan from there.
A concert or stadium—thousands of people, spotty internet, everyone trying to pay at once.

Current payment methods weren't built for range, crowds, or broadcast.

ultrasonic.fyi uses ultrasonic sound.
One merchant can broadcast to every customer in range—simultaneously.
No pairing. No camera alignment. Works even when connectivity is weak.

Sound fills the space. That's the difference.

---

## DEMO

Here's how it works.

On the left, we have the merchant POS—this could be a tablet at a coffee shop.
On the right, the customer's phone with their wallet.

The merchant enters an amount... let's say 5 dollars.
They hit charge.

Now the POS emits ultrasonic tones—frequencies between 18 and 19 kilohertz.
You can't hear it, but watch the frequency visualizer.

*(point to canvas)*

The customer's phone is listening. It decodes the sound into a payment request.

Customer sees the amount, the merchant name, confirms—and payment is sent via WalletConnect Pay.

No scanning. No pairing. The customer never even looked at the merchant's screen.

---

We also built an offline mode for peer-to-peer.
Instead of a payment ID, you can transmit your name directly through sound.

*(demo offline mode)*

This works completely without internet on the transmission side.

---

The web app works on any browser with Web Audio API.
We also have an iOS wallet that listens for these ultrasonic signals.

Everything uses FSK encoding—frequency-shift keying—the same technique used in old-school modems, but at frequencies humans can't hear.

---

## CLOSING

ultrasonic.fyi is crypto payments for the real world.

No cameras. No pairing. No friction.

Just sound.

Thanks for listening—literally.

---

*~2:30-2:50 depending on demo pace*
