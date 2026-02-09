/**
 * Service Chatbot avec OpenAI Assistant API
 * Support client automatisé, recherche produits, suivi commandes
 */

let openai;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

try {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI initialized');
    
    if (!ASSISTANT_ID) {
      console.warn('⚠️ OPENAI_ASSISTANT_ID not found - You need to create an assistant first');
    }
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found - Chatbot features disabled');
  }
} catch (error) {
  console.error('❌ Error initializing OpenAI:', error.message);
}

// ============================================
// SEARCH PRODUCTS (Tool Function)
// ============================================
const searchProducts = async (query, db) => {
  try {
    const result = await db.query(
      `SELECT 
        id, name, slug, short_description, price, 
        compare_at_price, featured_image, stock_quantity,
        category_name, brand_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.status = 'active' 
       AND (p.name ILIKE $1 OR p.description ILIKE $1 OR p.tags && ARRAY[$2])
       LIMIT 5`,
      [`%${query}%`, query]
    );

    return result.rows.map((product) => ({
      name: product.name,
      description: product.short_description,
      price: `${product.price}€`,
      url: `${process.env.FRONTEND_URL}/products/${product.slug}`,
      inStock: product.stock_quantity > 0,
      category: product.category_name,
      brand: product.brand_name,
    }));
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

// ============================================
// GET ORDER STATUS (Tool Function)
// ============================================
const getOrderStatus = async (orderNumber, db) => {
  try {
    const result = await db.query(
      `SELECT 
        order_number, status, payment_status, 
        total_amount, tracking_number, 
        created_at, shipped_at, delivered_at
       FROM orders 
       WHERE order_number = $1`,
      [orderNumber]
    );

    if (result.rows.length === 0) {
      return { error: 'Commande non trouvée' };
    }

    const order = result.rows[0];

    return {
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      totalAmount: `${order.total_amount}€`,
      trackingNumber: order.tracking_number,
      orderDate: new Date(order.created_at).toLocaleDateString('fr-FR'),
      shippedDate: order.shipped_at
        ? new Date(order.shipped_at).toLocaleDateString('fr-FR')
        : null,
      deliveredDate: order.delivered_at
        ? new Date(order.delivered_at).toLocaleDateString('fr-FR')
        : null,
    };
  } catch (error) {
    console.error('Error getting order status:', error);
    return { error: 'Erreur lors de la récupération de la commande' };
  }
};

// ============================================
// GET RECOMMENDATIONS (Tool Function)
// ============================================
const getRecommendations = async (categoryOrType, db) => {
  try {
    const result = await db.query(
      `SELECT 
        id, name, slug, price, featured_image, 
        is_on_sale, average_rating
       FROM products 
       WHERE status = 'active' 
       AND (category_id = $1 OR is_featured = true)
       ORDER BY sales_count DESC, average_rating DESC
       LIMIT 3`,
      [categoryOrType]
    );

    return result.rows.map((product) => ({
      name: product.name,
      price: `${product.price}€`,
      url: `${process.env.FRONTEND_URL}/products/${product.slug}`,
      onSale: product.is_on_sale,
      rating: product.average_rating,
    }));
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
};

// ============================================
// HANDLE TOOL CALLS
// ============================================
const executeToolCall = async (toolCall, db) => {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  let output;

  switch (functionName) {
    case 'search_products':
      output = await searchProducts(args.query, db);
      break;

    case 'get_order_status':
      output = await getOrderStatus(args.orderNumber, db);
      break;

    case 'get_recommendations':
      output = await getRecommendations(args.category, db);
      break;

    default:
      output = { error: 'Function not found' };
  }

  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify(output),
  };
};

// ============================================
// CREATE OR GET THREAD
// ============================================
const createOrGetThread = async (threadId = null) => {
  if (!openai) {
    throw new Error('OpenAI is not configured');
  }

  try {
    if (threadId) {
      // Vérifier si le thread existe
      const thread = await openai.beta.threads.retrieve(threadId);
      return thread;
    }

    // Créer un nouveau thread
    const thread = await openai.beta.threads.create();
    return thread;
  } catch (error) {
    console.error('Error creating/getting thread:', error);
    throw error;
  }
};

// ============================================
// SEND MESSAGE
// ============================================
/**
 * Envoyer un message au chatbot et obtenir la réponse
 * @param {string} message - Message utilisateur
 * @param {string} threadId - ID du thread (optionnel)
 * @param {Object} db - Instance de base de données
 * @returns {Promise<Object>} Réponse du chatbot
 */
const sendMessage = async (message, threadId, db) => {
  if (!openai) {
    throw new Error('OpenAI is not configured');
  }

  if (!ASSISTANT_ID) {
    throw new Error('OPENAI_ASSISTANT_ID not configured');
  }

  try {
    // Créer ou récupérer thread
    const thread = await createOrGetThread(threadId);

    // Ajouter le message utilisateur
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message,
    });

    // Lancer l'assistant
    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Attendre la complétion avec gestion des function calls
    while (run.status !== 'completed') {
      if (run.status === 'requires_action') {
        // Exécuter les function calls
        const toolCalls =
          run.required_action?.submit_tool_outputs?.tool_calls || [];

        const toolOutputs = await Promise.all(
          toolCalls.map((toolCall) => executeToolCall(toolCall, db))
        );

        // Soumettre les résultats
        run = await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
          tool_outputs: toolOutputs,
        });
      } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new Error(`Run failed with status: ${run.status}`);
      }

      // Attendre un peu avant de vérifier à nouveau
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Récupérer les messages
    const messages = await openai.beta.threads.messages.list(thread.id, {
      limit: 1,
      order: 'desc',
    });

    const lastMessage = messages.data[0];
    const responseContent =
      lastMessage.content[0].type === 'text'
        ? lastMessage.content[0].text.value
        : 'Désolé, je n\'ai pas pu générer de réponse.';

    return {
      threadId: thread.id,
      response: responseContent,
    };
  } catch (error) {
    console.error('Error sending message to chatbot:', error);
    throw error;
  }
};

// ============================================
// CREATE ASSISTANT (One-time setup)
// ============================================
/**
 * Créer l'assistant OpenAI (à exécuter une fois)
 * @returns {Promise<string>} ID de l'assistant
 */
const createAssistant = async () => {
  if (!openai) {
    throw new Error('OpenAI is not configured');
  }

  try {
    const assistant = await openai.beta.assistants.create({
      name: 'Assistant E-commerce VotreShop',
      instructions: `Tu es un assistant virtuel pour une boutique e-commerce.

Tu peux aider les clients à :
- Trouver des produits spécifiques
- Obtenir des recommandations
- Vérifier le statut de leurs commandes
- Répondre aux questions sur les produits
- Expliquer les politiques de retour et de livraison

Informations boutique :
- Livraison gratuite à partir de 50€
- Retours gratuits sous 30 jours
- Paiement sécurisé par Stripe
- Support client disponible 7j/7

Sois toujours courtois, concis et professionnel.
Si tu ne connais pas la réponse, dirige le client vers le support humain.`,
      model: 'gpt-4-turbo-preview',
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_products',
            description: 'Rechercher des produits par nom, catégorie ou mots-clés',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Terme de recherche (nom, catégorie, etc.)',
                },
              },
              required: ['query'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_order_status',
            description: 'Obtenir le statut d\'une commande',
            parameters: {
              type: 'object',
              properties: {
                orderNumber: {
                  type: 'string',
                  description: 'Numéro de la commande (ex: ORD-20250209-0001)',
                },
              },
              required: ['orderNumber'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_recommendations',
            description: 'Obtenir des recommandations de produits',
            parameters: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Catégorie de produits ou type (optionnel)',
                },
              },
            },
          },
        },
      ],
    });

    console.log('✅ Assistant créé avec succès');
    console.log('📋 Assistant ID:', assistant.id);
    console.log('⚠️ Ajoutez cet ID dans votre .env : OPENAI_ASSISTANT_ID=' + assistant.id);

    return assistant.id;
  } catch (error) {
    console.error('Error creating assistant:', error);
    throw error;
  }
};

module.exports = {
  sendMessage,
  createAssistant,
  searchProducts,
  getOrderStatus,
  getRecommendations,
};
