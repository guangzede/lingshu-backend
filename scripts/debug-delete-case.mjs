const baseUrl = 'http://localhost:10086/api'

const ts = Math.floor(Date.now() / 1000)
const username = `debug_${ts}`
const password = 'TestPass123'
const phone = `139${String(ts % 100000000).padStart(8, '0')}`

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data }
}

async function main() {
  console.log('USER', { username, phone })

  const register = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, phone }),
  })
  console.log('REGISTER', register)

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  console.log('LOGIN', login)

  const token = login?.data?.data?.token || ''
  console.log('TOKEN_LEN', token.length)

  const casePayload = {
    dateValue: '2026-02-17',
    timeValue: '12:00',
    lines: [
      { isYang: true, isMoving: false },
      { isYang: true, isMoving: false },
      { isYang: false, isMoving: false },
      { isYang: false, isMoving: true },
      { isYang: true, isMoving: true },
      { isYang: false, isMoving: false },
    ],
    ruleSetKey: 'jingfang-basic',
    question: 'delete-test',
  }

  const create = await request('/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(casePayload),
  })
  console.log('CREATE', create)

  const caseId = create?.data?.data?.id || ''
  console.log('CASE_ID', caseId)

  const list = await request('/cases?limit=5&offset=0', {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log('LIST', list)

  if (caseId) {
    const delOk = await request(`/cases/${caseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('DELETE_OK', delOk)

    const listAfter = await request('/cases?limit=5&offset=0', {
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('LIST_AFTER_DELETE', listAfter)
  }

  const delMissing = await request('/cases/999999', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log('DELETE_404', delMissing)
}

main().catch((err) => {
  console.error('SCRIPT_ERROR', err)
  process.exit(1)
})
