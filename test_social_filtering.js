import { getSocialCollaborativeFilteringRecommendations } from './utils/collaborativeFiltering.js'

console.log('Testing social collaborative filtering function...')

async function testSocialFiltering() {
  try {
    // Test with a mock user ID
    const result = await getSocialCollaborativeFilteringRecommendations(
      '507f1f77bcf86cd799439011',
      {
        limit: 1,
        page: 1,
      },
    )

    console.log('Function executed successfully')
    console.log('Result type:', typeof result)
    console.log('Result length:', Array.isArray(result) ? result.length : 'N/A')

    if (Array.isArray(result) && result.length > 0) {
      console.log('First result:', JSON.stringify(result[0], null, 2))
    }
  } catch (err) {
    console.error('Error occurred:', err.message)
    console.error('Error stack:', err.stack)
  }
}

testSocialFiltering()
