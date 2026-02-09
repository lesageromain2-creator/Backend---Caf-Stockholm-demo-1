/**
 * Service de gestion des expéditions avec Shippo
 * Calcul des tarifs, création d'étiquettes, suivi
 */

let shippo;

try {
  if (process.env.SHIPPO_API_KEY) {
    const Shippo = require('shippo');
    shippo = Shippo(process.env.SHIPPO_API_KEY);
    console.log('✅ Shippo initialized');
  } else {
    console.warn('⚠️ SHIPPO_API_KEY not found - Shipping features disabled');
  }
} catch (error) {
  console.error('❌ Error initializing Shippo:', error.message);
}

// ============================================
// ADRESSE PAR DÉFAUT (EXPÉDITEUR)
// ============================================
const DEFAULT_FROM_ADDRESS = {
  name: process.env.SHOP_NAME || 'VotreShop',
  company: process.env.SHOP_COMPANY || 'VotreShop SARL',
  street1: process.env.SHOP_ADDRESS || '123 Rue du Commerce',
  city: process.env.SHOP_CITY || 'Paris',
  state: process.env.SHOP_STATE || '',
  zip: process.env.SHOP_ZIP || '75001',
  country: process.env.SHOP_COUNTRY || 'FR',
  phone: process.env.SHOP_PHONE || '+33123456789',
  email: process.env.SHOP_EMAIL || 'contact@votreshop.com',
};

// ============================================
// CALCULATE SHIPPING RATES
// ============================================
/**
 * Calculer les tarifs d'expédition pour une commande
 * @param {Object} toAddress - Adresse de destination
 * @param {Object} parcel - Dimensions du colis
 * @returns {Promise<Array>} Liste des tarifs disponibles
 */
const calculateShippingRates = async (toAddress, parcel) => {
  if (!shippo) {
    // Fallback : tarifs fixes si Shippo non configuré
    return [
      {
        carrier: 'Standard',
        service: 'Livraison standard',
        price: 5.99,
        currency: 'EUR',
        estimatedDays: 3,
      },
      {
        carrier: 'Express',
        service: 'Livraison express',
        price: 12.99,
        currency: 'EUR',
        estimatedDays: 1,
      },
    ];
  }

  try {
    const shipment = await shippo.shipment.create({
      address_from: DEFAULT_FROM_ADDRESS,
      address_to: {
        name: toAddress.name || `${toAddress.firstName} ${toAddress.lastName}`,
        street1: toAddress.addressLine1,
        street2: toAddress.addressLine2 || '',
        city: toAddress.city,
        state: toAddress.state || '',
        zip: toAddress.postalCode,
        country: toAddress.country,
        phone: toAddress.phone || '',
        email: toAddress.email || '',
      },
      parcels: [
        {
          length: parcel.length?.toString() || '30',
          width: parcel.width?.toString() || '20',
          height: parcel.height?.toString() || '10',
          distance_unit: 'cm',
          weight: parcel.weight?.toString() || '1',
          mass_unit: 'kg',
        },
      ],
      async: false,
    });

    if (!shipment.rates || shipment.rates.length === 0) {
      throw new Error('Aucun tarif disponible pour cette destination');
    }

    return shipment.rates.map((rate) => ({
      rateId: rate.object_id,
      carrier: rate.provider,
      service: rate.servicelevel.name,
      price: parseFloat(rate.amount),
      currency: rate.currency,
      estimatedDays: rate.estimated_days,
      duration: rate.duration_terms,
    }));
  } catch (error) {
    console.error('Error calculating shipping rates:', error);
    throw error;
  }
};

// ============================================
// CREATE SHIPPING LABEL
// ============================================
/**
 * Créer une étiquette d'expédition
 * @param {string} rateId - ID du tarif sélectionné
 * @param {string} orderId - ID de la commande
 * @returns {Promise<Object>} Informations sur l'étiquette
 */
const createShippingLabel = async (rateId, orderId) => {
  if (!shippo) {
    throw new Error('Shippo is not configured');
  }

  try {
    const transaction = await shippo.transaction.create({
      rate: rateId,
      label_file_type: 'PDF',
      async: false,
      metadata: {
        order_id: orderId,
      },
    });

    if (transaction.status !== 'SUCCESS') {
      throw new Error(
        transaction.messages?.[0]?.text || 'Failed to create shipping label'
      );
    }

    return {
      labelUrl: transaction.label_url,
      trackingNumber: transaction.tracking_number,
      trackingUrl: transaction.tracking_url_provider,
      carrier: transaction.rate.provider,
      service: transaction.rate.servicelevel.name,
      transactionId: transaction.object_id,
    };
  } catch (error) {
    console.error('Error creating shipping label:', error);
    throw error;
  }
};

// ============================================
// GET TRACKING INFO
// ============================================
/**
 * Obtenir les informations de suivi d'un colis
 * @param {string} trackingNumber - Numéro de suivi
 * @param {string} carrier - Transporteur
 * @returns {Promise<Object>} État du suivi
 */
const getTrackingInfo = async (trackingNumber, carrier) => {
  if (!shippo) {
    throw new Error('Shippo is not configured');
  }

  try {
    const tracking = await shippo.track.get(carrier, trackingNumber);

    return {
      trackingNumber: tracking.tracking_number,
      carrier: tracking.carrier,
      status: tracking.tracking_status.status,
      statusDetails: tracking.tracking_status.status_details,
      location: tracking.tracking_status.location,
      eta: tracking.eta,
      trackingHistory: tracking.tracking_history.map((event) => ({
        status: event.status,
        statusDetails: event.status_details,
        location: event.location,
        date: event.status_date,
      })),
    };
  } catch (error) {
    console.error('Error getting tracking info:', error);
    throw error;
  }
};

// ============================================
// VALIDATE ADDRESS
// ============================================
/**
 * Valider une adresse
 * @param {Object} address - Adresse à valider
 * @returns {Promise<Object>} Adresse validée
 */
const validateAddress = async (address) => {
  if (!shippo) {
    // Retourner l'adresse telle quelle si Shippo non configuré
    return { isValid: true, address };
  }

  try {
    const validation = await shippo.address.create({
      name: address.name || `${address.firstName} ${address.lastName}`,
      street1: address.addressLine1,
      street2: address.addressLine2 || '',
      city: address.city,
      state: address.state || '',
      zip: address.postalCode,
      country: address.country,
      validate: true,
    });

    return {
      isValid: validation.validation_results.is_valid,
      address: validation,
      messages: validation.validation_results.messages || [],
    };
  } catch (error) {
    console.error('Error validating address:', error);
    throw error;
  }
};

// ============================================
// CALCULATE PARCEL DIMENSIONS FROM ORDER
// ============================================
/**
 * Calculer les dimensions d'un colis à partir des produits
 * @param {Array} orderItems - Articles de la commande
 * @returns {Object} Dimensions du colis
 */
const calculateParcelDimensions = (orderItems) => {
  // Dimensions par défaut si non spécifiées
  const defaultParcel = {
    length: 30,
    width: 20,
    height: 10,
    weight: 1,
  };

  if (!orderItems || orderItems.length === 0) {
    return defaultParcel;
  }

  // TODO: Améliorer avec les vraies dimensions des produits
  // Pour l'instant, on utilise des dimensions standard basées sur la quantité
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  
  return {
    length: Math.min(30 + totalQuantity * 5, 100), // Max 100cm
    width: Math.min(20 + totalQuantity * 3, 80),   // Max 80cm
    height: Math.min(10 + totalQuantity * 2, 50),  // Max 50cm
    weight: Math.max(1, totalQuantity * 0.5),      // Min 1kg, 0.5kg par article
  };
};

// ============================================
// GET SHIPPING RATES FOR ORDER
// ============================================
/**
 * Obtenir les tarifs d'expédition pour une commande complète
 * @param {string} orderId - ID de la commande
 * @param {Object} db - Instance de base de données
 * @returns {Promise<Array>} Tarifs disponibles
 */
const getShippingRatesForOrder = async (orderId, db) => {
  try {
    // Récupérer la commande avec les items
    const orderResult = await db.query(
      `SELECT o.*, 
              json_agg(oi.*) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Commande non trouvée');
    }

    const order = orderResult.rows[0];
    const shippingAddress = order.shipping_address;
    const parcel = calculateParcelDimensions(order.items);

    const rates = await calculateShippingRates(shippingAddress, parcel);

    return rates;
  } catch (error) {
    console.error('Error getting shipping rates for order:', error);
    throw error;
  }
};

module.exports = {
  calculateShippingRates,
  createShippingLabel,
  getTrackingInfo,
  validateAddress,
  calculateParcelDimensions,
  getShippingRatesForOrder,
};
