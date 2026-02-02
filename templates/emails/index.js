// backend/templates/emails/index.js
const { 
    generateBaseEmailHTML, 
    replaceVariables,
    createButton,
    createInfoBox,
    createDivider
  } = require('./base');
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // ============================================
  // 1. EMAIL DE BIENVENUE
  // ============================================
  
  const welcomeEmail = (variables) => {
    const { firstname, email } = variables;
    
    const content = `
      <h1>Bienvenue ${firstname} ! 🚀</h1>
      
      <p>Merci d'avoir rejoint <strong>LE SAGE DEV</strong>, votre partenaire pour la création de solutions web sur mesure.</p>
      
      <p>Votre compte a été créé avec succès. Vous pouvez dès maintenant :</p>
      
      <ul style="line-height: 1.8; color: #333;">
        <li>📅 Réserver un rendez-vous découverte gratuit</li>
        <li>💼 Découvrir nos offres et services</li>
        <li>📂 Consulter notre portfolio de projets</li>
        <li>📧 Nous contacter pour discuter de votre projet</li>
      </ul>
      
      ${createButton('Accéder à mon espace', `${frontendUrl}/dashboard`)}
      
      ${createDivider()}
      
      <p><strong>Vous avez un projet en tête ?</strong></p>
      <p>Réservez dès maintenant un appel découverte de 30 minutes pour discuter de vos besoins.</p>
      
      ${createButton('Réserver un rendez-vous', `${frontendUrl}/reservation`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Si vous avez des questions, n'hésitez pas à nous contacter à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Bienvenue sur LE SAGE DEV',
      preheader: 'Votre compte a été créé avec succès',
      content,
      variables
    });
  };
  
  // ============================================
  // 2. RÉSERVATION CRÉÉE
  // ============================================
  
  const reservationCreatedEmail = (variables) => {
    const { 
      firstname, 
      reservation_date, 
      reservation_time, 
      meeting_type,
      project_type,
      reservation_id 
    } = variables;
    
    const meetingTypeLabel = meeting_type === 'visio' ? '🎥 Visioconférence' : '🏢 Présentiel';
    
    const content = `
      <h1>Votre rendez-vous est enregistré ! 📅</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Votre demande de rendez-vous a bien été enregistrée. Nous allons la confirmer dans les plus brefs délais.</p>
      
      ${createInfoBox([
        { label: 'Date', value: new Date(reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Heure', value: reservation_time },
        { label: 'Type de rendez-vous', value: meetingTypeLabel },
        { label: 'Type de projet', value: project_type || 'À définir' }
      ])}
      
      <p><strong>Prochaines étapes :</strong></p>
      <ol style="line-height: 1.8; color: #333;">
        <li>Nous confirmons votre rendez-vous (vous recevrez un email)</li>
        <li>Vous recevrez un lien de visioconférence (si applicable)</li>
        <li>Nous discutons de votre projet en détail</li>
        <li>Nous établissons un devis personnalisé</li>
      </ol>
      
      ${createButton('Voir ma réservation', `${frontendUrl}/dashboard#reservations`)}
      
      ${createDivider()}
      
      <p style="font-size: 14px; color: #666;">
        <strong>Besoin de modifier ou d'annuler ?</strong><br>
        Vous pouvez gérer votre réservation depuis votre espace personnel.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous enregistré - LE SAGE DEV',
      preheader: `Votre rendez-vous du ${reservation_date} à ${reservation_time}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 3. RÉSERVATION CONFIRMÉE
  // ============================================
  
  const reservationConfirmedEmail = (variables) => {
    const { 
      firstname, 
      reservation_date, 
      reservation_time, 
      meeting_type,
      meeting_link 
    } = variables;
    
    const meetingTypeLabel = meeting_type === 'visio' ? '🎥 Visioconférence' : '🏢 Présentiel';
    
    const content = `
      <h1>Rendez-vous confirmé ! ✅</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Bonne nouvelle ! Votre rendez-vous a été <strong>confirmé</strong>.</p>
      
      ${createInfoBox([
        { label: 'Date', value: new Date(reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Heure', value: reservation_time },
        { label: 'Type', value: meetingTypeLabel }
      ])}
      
      ${meeting_type === 'visio' && meeting_link ? `
        <p><strong>Lien de visioconférence :</strong></p>
        ${createButton('Rejoindre la visio', meeting_link)}
        <p style="font-size: 14px; color: #666;">
          💡 Vous pouvez vous connecter 5 minutes avant l'heure prévue.
        </p>
      ` : ''}
      
      ${createDivider()}
      
      <p><strong>Pour préparer notre échange :</strong></p>
      <ul style="line-height: 1.8; color: #333;">
        <li>Préparez une liste de vos besoins et objectifs</li>
        <li>Si vous avez des références visuelles, n'hésitez pas</li>
        <li>Pensez à votre budget et vos délais</li>
      </ul>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        <strong>Un empêchement ?</strong><br>
        Prévenez-nous au plus vite à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous confirmé - LE SAGE DEV',
      preheader: `Votre RDV du ${reservation_date} est confirmé`,
      content,
      variables
    });
  };
  
  // ============================================
  // 4. RÉSERVATION ANNULÉE
  // ============================================
  
  const reservationCancelledEmail = (variables) => {
    const { firstname, reservation_date, cancellation_reason } = variables;
    
    const content = `
      <h1>Rendez-vous annulé</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Votre rendez-vous du <strong>${new Date(reservation_date).toLocaleDateString('fr-FR')}</strong> a été annulé.</p>
      
      ${cancellation_reason ? `
        <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;"><strong>Raison :</strong> ${cancellation_reason}</p>
        </div>
      ` : ''}
      
      <p>Pas de souci ! Vous pouvez reprendre rendez-vous quand vous le souhaitez.</p>
      
      ${createButton('Reprendre rendez-vous', `${frontendUrl}/reservation`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Des questions ? Contactez-nous à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous annulé - LE SAGE DEV',
      preheader: 'Votre rendez-vous a été annulé',
      content,
      variables
    });
  };
  
  // ============================================
  // 5. PROJET CRÉÉ
  // ============================================
  
  const projectCreatedEmail = (variables) => {
    const { firstname, project_title, project_type, start_date } = variables;
    
    const content = `
      <h1>Votre projet est lancé ! 🚀</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Excellente nouvelle ! Votre projet <strong>"${project_title}"</strong> vient d'être créé.</p>
      
      ${createInfoBox([
        { label: 'Nom du projet', value: project_title },
        { label: 'Type', value: project_type },
        { label: 'Date de démarrage', value: start_date ? new Date(start_date).toLocaleDateString('fr-FR') : 'À définir' }
      ])}
      
      <p><strong>Prochaines étapes :</strong></p>
      <ol style="line-height: 1.8; color: #333;">
        <li>✅ Analyse détaillée de vos besoins</li>
        <li>🎨 Conception et maquettes</li>
        <li>⚙️ Développement</li>
        <li>✨ Tests et livraison</li>
      </ol>
      
      ${createButton('Suivre mon projet', `${frontendUrl}/dashboard#projects`)}
      
      ${createDivider()}
      
      <p style="font-size: 14px; color: #666;">
        Vous recevrez des notifications à chaque étape importante de votre projet.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Votre projet est lancé - LE SAGE DEV',
      preheader: `Le projet "${project_title}" a été créé`,
      content,
      variables
    });
  };
  
  // ============================================
  // 6. PROJET MIS À JOUR
  // ============================================
  
  const projectUpdatedEmail = (variables) => {
    const { firstname, project_title, update_type, update_message, project_id } = variables;
    
    const updateIcons = {
      'info': 'ℹ️',
      'milestone': '🎯',
      'issue': '⚠️',
      'question': '❓',
      'completed': '✅'
    };
    
    const icon = updateIcons[update_type] || 'ℹ️';
    
    const content = `
      <h1>Mise à jour de votre projet ${icon}</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Une nouvelle mise à jour est disponible pour votre projet <strong>"${project_title}"</strong>.</p>
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27; font-size: 15px;">
          ${update_message}
        </p>
      </div>
      
      ${createButton('Voir les détails', `${frontendUrl}/dashboard/projects/${project_id}`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Vous pouvez répondre directement depuis votre espace client.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: `Mise à jour - ${project_title}`,
      preheader: update_message.substring(0, 100),
      content,
      variables
    });
  };
  
  // ============================================
  // 7. MESSAGE CONTACT REÇU (pour admin)
  // ============================================
  
  const contactMessageReceivedEmail = (variables) => {
    const { name, email, subject, message, message_id } = variables;
    
    const content = `
      <h1>Nouveau message de contact 📧</h1>
      
      <p>Un nouveau message a été reçu via le formulaire de contact.</p>
      
      ${createInfoBox([
        { label: 'Nom', value: name },
        { label: 'Email', value: email },
        { label: 'Sujet', value: subject }
      ])}
      
      <div class="info-box" style="background: #f5f7fa; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27; white-space: pre-wrap;">${message}</p>
      </div>
      
      ${createButton('Répondre au message', `${frontendUrl}/admin/messages/${message_id}`)}
    `;
  
    return generateBaseEmailHTML({
      title: 'Nouveau message de contact',
      preheader: `Message de ${name} : ${subject}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 8. RÉPONSE À UN MESSAGE CONTACT (pour client)
  // ============================================
  
  const contactReplyEmail = (variables) => {
    const { firstname, original_message, reply_message, admin_name } = variables;
    
    const content = `
      <h1>Réponse à votre message 💬</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>${admin_name || 'Notre équipe'} a répondu à votre message :</p>
      
      <div style="background: #f5f7fa; padding: 15px; margin: 20px 0; border-radius: 4px; border-left: 3px solid #ccc;">
        <p style="margin: 0; font-size: 14px; color: #666; font-style: italic;">
          "${original_message.substring(0, 150)}${original_message.length > 150 ? '...' : ''}"
        </p>
      </div>
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; color: #0066FF; font-weight: 600;">Réponse de ${admin_name || 'LE SAGE DEV'} :</p>
        <p style="margin: 0; color: #0A0E27; white-space: pre-wrap;">${reply_message}</p>
      </div>
      
      ${createButton('Voir la conversation', `${frontendUrl}/mes-messages`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Vous pouvez continuer la conversation en répondant à cet email.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Réponse à votre message - LE SAGE DEV',
      preheader: `${admin_name || 'Notre équipe'} a répondu à votre message`,
      content,
      variables
    });
  };
  
  // ============================================
  // 9. RESET PASSWORD
  // ============================================
  
  const passwordResetEmail = (variables) => {
    const { firstname, reset_link, expires_in } = variables;
    
    const content = `
      <h1>Réinitialisation de mot de passe 🔐</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.</p>
      
      ${createButton('Réinitialiser mon mot de passe', reset_link)}
      
      <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          ⚠️ <strong>Ce lien expire dans ${expires_in || '1 heure'}.</strong>
        </p>
      </div>
      
      <p style="font-size: 14px; color: #666;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe actuel reste inchangé.
      </p>
      
      ${createDivider()}
      
      <p style="font-size: 12px; color: #999;">
        Pour des raisons de sécurité, ne partagez jamais ce lien.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Réinitialisation de mot de passe - LE SAGE DEV',
      preheader: 'Cliquez pour créer un nouveau mot de passe',
      content,
      variables
    });
  };
  
  // ============================================
  // 10. EMAIL VERIFICATION
  // ============================================
  
  const emailVerificationEmail = (variables) => {
    const { firstname, verification_link, expires_in } = variables;
    
    const content = `
      <h1>Vérifiez votre adresse email ✉️</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Merci de vous être inscrit sur LE SAGE DEV ! Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.</p>
      
      ${createButton('Vérifier mon email', verification_link)}
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27;">
          ⏰ Ce lien expire dans ${expires_in || '24 heures'}.
        </p>
      </div>
      
      <p style="font-size: 14px; color: #666;">
        Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Vérifiez votre email - LE SAGE DEV',
      preheader: 'Confirmez votre adresse email pour continuer',
      content,
      variables
    });
  };
  
  // ============================================
  // 11. RESERVATION REMINDER
  // ============================================
  
  const reservationReminderEmail = (variables) => {
    const { firstname, reservation_date, reservation_time, meeting_type, meeting_link } = variables;
    
    const meetingTypeLabel = meeting_type === 'visio' ? '🎥 Visioconférence' : '🏢 Présentiel';
    
    const content = `
      <h1>Rappel : Rendez-vous demain ! 🔔</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Nous vous rappelons que votre rendez-vous avec LE SAGE DEV est prévu <strong>demain</strong>.</p>
      
      ${createInfoBox([
        { label: 'Date', value: new Date(reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Heure', value: reservation_time },
        { label: 'Type', value: meetingTypeLabel }
      ])}
      
      ${meeting_type === 'visio' && meeting_link ? `
        ${createButton('Rejoindre la visio', meeting_link)}
        <p style="font-size: 14px; color: #666;">
          💡 Vous pouvez vous connecter 5 minutes avant l'heure prévue.
        </p>
      ` : ''}
      
      <p style="font-size: 14px; color: #666;">
        <strong>Un empêchement de dernière minute ?</strong><br>
        Contactez-nous au plus vite : <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rappel rendez-vous - LE SAGE DEV',
      preheader: `Rendez-vous demain à ${reservation_time}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 12. PROJECT STATUS CHANGED
  // ============================================
  
  const projectStatusChangedEmail = (variables) => {
    const { firstname, project_title, old_status, new_status, project_id } = variables;
    
    const statusLabels = {
      'discovery': '🔍 Découverte',
      'design': '🎨 Design',
      'development': '⚙️ Développement',
      'testing': '🧪 Tests',
      'launched': '🚀 Lancé',
      'completed': '✅ Terminé'
    };
    
    const content = `
      <h1>Changement de statut du projet</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Le statut de votre projet <strong>"${project_title}"</strong> a été mis à jour.</p>
      
      ${createInfoBox([
        { label: 'Ancien statut', value: statusLabels[old_status] || old_status },
        { label: 'Nouveau statut', value: statusLabels[new_status] || new_status }
      ])}
      
      ${createButton('Voir les détails', `${frontendUrl}/dashboard/projects/${project_id}`)}
      
      <p style="font-size: 14px; color: #666;">
        Consultez votre espace client pour plus d'informations sur cette mise à jour.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: `Statut projet mis à jour - ${project_title}`,
      preheader: `Le statut de votre projet est passé à ${statusLabels[new_status]}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 13. PROJECT DELIVERED
  // ============================================
  
  const projectDeliveredEmail = (variables) => {
    const { firstname, project_title, project_url, project_id } = variables;
    
    const content = `
      <h1>Votre projet est livré ! 🎉</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Excellente nouvelle ! Votre projet <strong>"${project_title}"</strong> est maintenant terminé et livré.</p>
      
      ${project_url ? `
        ${createInfoBox([
          { label: 'URL du projet', value: `<a href="${project_url}" style="color: #0066FF;">${project_url}</a>` }
        ])}
      ` : ''}
      
      ${createButton('Voir mon projet', project_url || `${frontendUrl}/dashboard/projects/${project_id}`)}
      
      ${createDivider()}
      
      <p><strong>Et maintenant ?</strong></p>
      <ul style="line-height: 1.8; color: #333;">
        <li>✅ Testez toutes les fonctionnalités</li>
        <li>💬 Partagez vos retours et commentaires</li>
        <li>📱 Partagez votre projet sur les réseaux sociaux</li>
        <li>⭐ Laissez-nous un témoignage (optionnel)</li>
      </ul>
      
      <p style="margin-top: 30px;">
        Nous restons à votre disposition pour tout support ou évolution future de votre projet.
      </p>
      
      <p style="font-size: 14px; color: #666;">
        Merci de votre confiance ! 🙏
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Projet livré - LE SAGE DEV',
      preheader: `Votre projet ${project_title} est prêt !`,
      content,
      variables
    });
  };
  
  // ============================================
  // 14. FILE UPLOADED
  // ============================================
  
  const fileUploadedEmail = (variables) => {
    const { firstname, project_title, file_name, uploaded_by, project_id } = variables;
    
    const content = `
      <h1>Nouveau fichier ajouté 📎</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Un nouveau fichier a été ajouté au projet <strong>"${project_title}"</strong>.</p>
      
      ${createInfoBox([
        { label: 'Fichier', value: file_name },
        { label: 'Ajouté par', value: uploaded_by }
      ])}
      
      ${createButton('Consulter le fichier', `${frontendUrl}/dashboard/projects/${project_id}#files`)}
    `;
  
    return generateBaseEmailHTML({
      title: 'Nouveau fichier - LE SAGE DEV',
      preheader: `${file_name} a été ajouté au projet`,
      content,
      variables
    });
  };
  
  // ============================================
  // 15. PAYMENT SUCCESS
  // ============================================
  
  const paymentSuccessEmail = (variables) => {
    const { firstname, amount, currency, payment_date, invoice_url, project_title } = variables;
    
    const content = `
      <h1>Paiement confirmé ! ✅</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Nous confirmons la réception de votre paiement.</p>
      
      ${createInfoBox([
        { label: 'Montant', value: `${amount} ${currency || 'EUR'}` },
        { label: 'Date', value: new Date(payment_date).toLocaleDateString('fr-FR') },
        { label: 'Projet', value: project_title || 'N/A' }
      ])}
      
      ${invoice_url ? createButton('Télécharger la facture', invoice_url) : ''}
      
      <p style="font-size: 14px; color: #666;">
        Vous pouvez également retrouver cette facture dans votre espace client.
      </p>
      
      <p style="margin-top: 30px;">
        Merci pour votre confiance ! 🙏
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Paiement confirmé - LE SAGE DEV',
      preheader: `Paiement de ${amount} ${currency || 'EUR'} confirmé`,
      content,
      variables
    });
  };
  
  // ============================================
  // 16. PAYMENT FAILED
  // ============================================
  
  const paymentFailedEmail = (variables) => {
    const { firstname, amount, currency, error_message, payment_link } = variables;
    
    const content = `
      <h1>Échec du paiement ⚠️</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Malheureusement, votre paiement de <strong>${amount} ${currency || 'EUR'}</strong> n'a pas pu être traité.</p>
      
      ${error_message ? `
        <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;">
            <strong>Raison :</strong> ${error_message}
          </p>
        </div>
      ` : ''}
      
      <p><strong>Que faire ?</strong></p>
      <ul style="line-height: 1.8; color: #333;">
        <li>Vérifiez les informations de votre carte bancaire</li>
        <li>Assurez-vous d'avoir suffisamment de fonds</li>
        <li>Contactez votre banque si le problème persiste</li>
      </ul>
      
      ${payment_link ? createButton('Réessayer le paiement', payment_link) : ''}
      
      <p style="font-size: 14px; color: #666;">
        Besoin d'aide ? Contactez-nous : <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Échec du paiement - LE SAGE DEV',
      preheader: 'Votre paiement n\'a pas pu être traité',
      content,
      variables
    });
  };
  
  // ============================================
  // 17. INVOICE
  // ============================================
  
  const invoiceEmail = (variables) => {
    const { firstname, invoice_number, amount, currency, due_date, invoice_url, project_title } = variables;
    
    const content = `
      <h1>Nouvelle facture 📄</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Votre facture est disponible.</p>
      
      ${createInfoBox([
        { label: 'Numéro de facture', value: invoice_number },
        { label: 'Montant', value: `${amount} ${currency || 'EUR'}` },
        { label: 'Date d\'échéance', value: new Date(due_date).toLocaleDateString('fr-FR') },
        { label: 'Projet', value: project_title || 'N/A' }
      ])}
      
      ${createButton('Télécharger la facture', invoice_url)}
      
      <p style="font-size: 14px; color: #666;">
        Merci de procéder au paiement avant la date d'échéance.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: `Facture ${invoice_number} - LE SAGE DEV`,
      preheader: `Nouvelle facture de ${amount} ${currency || 'EUR'}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 18. NEWSLETTER
  // ============================================
  
  const newsletterEmail = (variables) => {
    const { firstname, subject, content: newsletterContent } = variables;
    
    const content = `
      <h1>${subject}</h1>
      
      <p>Bonjour ${firstname || 'cher abonné'},</p>
      
      ${newsletterContent}
      
      ${createDivider()}
      
      <p style="font-size: 14px; color: #666;">
        Vous recevez cet email car vous êtes inscrit à la newsletter LE SAGE DEV.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: subject,
      preheader: subject,
      content,
      variables
    });
  };
  
  // ============================================
  // 19. NOTIFICATION (Generic)
  // ============================================
  
  const notificationEmail = (variables) => {
    const { firstname, notification_title, notification_message, action_url, action_label } = variables;
    
    const content = `
      <h1>${notification_title}</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27;">
          ${notification_message}
        </p>
      </div>
      
      ${action_url && action_label ? createButton(action_label, action_url) : ''}
    `;
  
    return generateBaseEmailHTML({
      title: notification_title,
      preheader: notification_message.substring(0, 100),
      content,
      variables
    });
  };
  
  // ============================================
  // EXPORTS
  // ============================================
  
  module.exports = {
    // Auth
    welcomeEmail,
    emailVerificationEmail,
    passwordResetEmail,
    
    // Reservations
    reservationCreatedEmail,
    reservationConfirmedEmail,
    reservationCancelledEmail,
    reservationReminderEmail,
    
    // Projects
    projectCreatedEmail,
    projectUpdatedEmail,
    projectStatusChangedEmail,
    projectDeliveredEmail,
    
    // Contact
    contactMessageReceivedEmail,
    contactReplyEmail,
    
    // Files & Payments
    fileUploadedEmail,
    paymentSuccessEmail,
    paymentFailedEmail,
    invoiceEmail,
    
    // Others
    newsletterEmail,
    notificationEmail
  };