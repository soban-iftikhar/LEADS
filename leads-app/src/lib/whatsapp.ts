const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

export async function sendWhatsAppOTP(
  phone: string,
  otp: string
): Promise<boolean> {
  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPakistaniPhone(phone),           
        type: 'text',
        text: {
          body: `Your LEADS verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('WhatsApp OTP error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('WhatsApp send failed:', error)
    return false
  }
}

export function formatPakistaniPhone(phone: string): string {
  // remove spaces, dashes, +
  const cleaned = phone.replace(/[\s\-\+]/g, '')
  
  // if starts with 0, replace with 92
  if (cleaned.startsWith('0')) {
    return '92' + cleaned.slice(1)
  }
  
  // if already starts with 92
  if (cleaned.startsWith('92')) {
    return cleaned
  }

  return '92' + cleaned
}