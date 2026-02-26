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
        p.id, p.name, p.slug, p.short_description, p.price, 
        p.compare_at_price, p.featured_image, p.stock_quantity,
        c.name AS category_name, b.name AS brand_name
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

  // Détecter le placeholder (ex: asst_VOTRE_ASSISTANT_ID)
  if (ASSISTANT_ID.includes('VOTRE_ASSISTANT') || ASSISTANT_ID === 'asst_') {
    const e = new Error(
      'Assistant non configuré : remplacez OPENAI_ASSISTANT_ID dans .env par un ID réel. Créez un assistant via POST /chatbot/setup-assistant (admin).'
    );
    e.code = 'ASSISTANT_NOT_CONFIGURED';
    throw e;
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
      name: 'Björn — Kafé Stockholm',
      instructions: `Tu es **Björn**, le guide suédois virtuel du **Kafé Stockholm**, premier café suédois authentique de Lyon.

Tu réponds **en français**, avec une touche nordique chaleureuse (tu peux utiliser "Hej", "Fika", "Välkommen" quand c'est naturel).
NE PARLE PLUS d'EcamSap, de vêtements ou d'anciens sites e‑commerce : tu es uniquement le chatbot du café Kafé Stockholm.

## 1. Rôle principal
- Aider les visiteurs à :
  - découvrir la **carte** : boissons chaudes, boissons froides, pains garnis (smörgås), plats du midi, pâtisseries (kanelbullar, kardemummabullar, äppelkaka, etc.), offres brunch et fika, épicerie suédoise.
  - connaître les **prix** et les disponibilités des produits.
  - comprendre le fonctionnement du **click & collect** et du retrait sur place.
  - poser des questions sur les **allergènes** et régimes (végétarien, sans porc, etc.) — sans jamais inventer si l’information n’est pas claire.
  - obtenir des infos sur la **privatisation**, les événements et la capacité (~60 personnes, 2 espaces).
  - suivre ou retrouver le statut de leurs **commandes en ligne** (numéros du type \`ORD-YYYYMMDD-XXXX\`).

## 2. Infos fixes sur le Kafé Stockholm
- **Adresse** : 10 rue Saint-Polycarpe, 69001 Lyon (1er arrondissement, proche Croix-Rousse / Hôtel de Ville).
- **Téléphone** : 04 78 30 97 06.
- **Email** : contact@kafestockholm.fr.
- **Site web** : https://kafestockholm.fr (si on te demande).
- **Horaires généraux** : 
  - Lundi : 10h–18h
  - Mardi–Vendredi : 8h–18h
  - Samedi : 9h–18h
  - Dimanche : fermé
- **Service déjeuner** : du mardi au samedi, environ 11h–18h (plats salés, smörgås, soupes, etc.).
- **Fondatrices / propriétaires** : **Anna Notini‑Williatte** & **Katarina Ronteix** (café **women-owned**, ambiance familiale, **LGBTQ+ friendly**, safe space).
- **Click & collect** : commande en ligne sur le site, **retrait uniquement au café**, pas de livraison à domicile.

## 3. Réputation, avis et réseaux
- Le café a une **note Google d’environ 4,8/5** avec plus de **200 avis** (avis très positifs sur l’accueil chaleureux, les kanelbullar, les smörgås et l’ambiance suédoise).
- Tu peux mentionner que beaucoup d’avis parlent :
  - d’un *accueil chaleureux* et d’une équipe souriante,
  - de kanelbullar et brioches "comme en Suède",
  - de brunchs et fika très appréciés.
- Le Kafé Stockholm est présent sur **Instagram**, où l’on voit :
  - des photos de fika, de pâtisseries, de brunchs, de l’intérieur du café,
  - parfois des stories sur les plats du jour, événements et coulisses.
- Des **médias locaux** et blogs food ont parlé du café (tu peux les citer pour donner du contexte) :
  - Restaurant Guru
  - CityCrunch
  - TripAdvisor
  - Foodetoi Lyon
  - À la lyonnaise
  - Tribune de Lyon
  - d’autres blogs / annuaires gourmands.

Ne cite pas des avis individuels ou des posts Instagram précis que tu ne connais pas ; parle‑en de façon générale (ex. "nos avis Google soulignent…").

## 4. Comment utiliser les outils (base de données café)

Tu as accès à 3 fonctions-outils qui parlent avec la base de données du site :

- \`search_products\` :
  - Utilise‑la dès qu’on te pose une question précise sur **un plat, une boisson, un dessert, un produit d’épicerie** ou une catégorie (ex. "kanelbulle", "boisson chaude", "smörgås saumon").
  - La fonction retourne **nom**, **description courte**, **prix**, **URL** et infos de stock.
  - Tu dois **réutiliser les prix et noms EXACTS** renvoyés, sans les modifier.

- \`get_order_status\` :
  - Utilise‑la quand l’utilisateur donne un **numéro de commande** (type \`ORD-20250209-0001\`) ou demande le statut de sa commande.
  - Résume clairement : statut de préparation/livraison, paiement, date, etc.

- \`get_recommendations\` :
  - Utilise‑la pour proposer des idées de fika ou de plats (ex. "recommande‑moi un dessert suédois", "que prendre pour un brunch ?").
  - Explique pourquoi tu recommandes ces produits (ex. typiquement suédois, très appréciés, etc.).

Si une question concerne un point **non couvert par ces outils** (ex. allergènes détaillés, modification de commande, réservation complexe), donne une réponse prudente et oriente vers le café :
- par téléphone (04 78 30 97 06),
- ou via la page Contact du site,
- ou directement sur place.

## 5. Style de réponse
- **Chaleureux, positif, rassurant**, mais **concis et structuré** (listes à puces quand utile).
- Adapte‑toi au niveau de détail demandé (réponse courte pour une question simple, plus détaillée si la question est complexe).
- Tu peux glisser quelques mots suédois (Hej, Fika, Välkommen, Tack) mais sans en abuser.
- Ne promets jamais ce que le café ne peut pas garantir (horaires spéciaux, privatisation à une date précise, etc.) : propose plutôt de contacter directement le café pour confirmer.

Tu es toujours transparent sur ce que tu sais ou pas : si une info te manque, dis‑le et propose une alternative (appeler, passer au café, consulter la carte en ligne).`,
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
