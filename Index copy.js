// ====================== CONFIG ======================
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const express = require('express');

// ====================== SERVEUR HTTP POUR RENDER ======================
const app = express();
const PORT = process.env.PORT || 3000; // Render fournit le PORT automatiquement
app.get('/', (req, res) => res.send('Bot Discord actif !'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ====================== CLIENT DISCORD ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ====================== VARIABLES ======================
const PREFIX = process.env.PREFIX || '+';                // Préfixe des commandes
const TOKEN = process.env.DISCORD_TOKEN;                // Token Discord
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;      // ID du channel logs
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;    // ID rôle support
const TICKET_ROLE_ID = process.env.TICKET_ROLE_ID;      // ID rôle pour tickets
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID; // ID catégorie ticket

// Vérifications sécurisées
if (!TOKEN) {
  console.error('Erreur : DISCORD_TOKEN manquant dans Secrets');
  process.exit(1);
}
if (!LOG_CHANNEL_ID || !SUPPORT_ROLE_ID || !TICKET_ROLE_ID || !TICKET_CATEGORY_ID) {
  console.error('Erreur : Secrets manquants pour tickets/logs');
  process.exit(1);
}
// ========================================================

// ====================== READY ======================
client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// ====================== LOG FUNCTION ======================
async function log(guild, text) {
  if (!LOG_CHANNEL_ID) return;
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send(text).catch(() => {});
}

// ====================== COMMANDES ======================
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ===== HELP =====
  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📘 Commandes du serveur')
      .setColor('#5865F2')
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'La Commu Chill 💜' })
      .setDescription('Voici toutes les commandes disponibles :')
      .addFields(
        { name: '🎫 Tickets', value: '`+panel` • `+rename <nom>` • `+close`' },
        { name: '🛠️ Modération', value: '`+kick` • `+ban` • `+mute` • `+unmute` • `+warn` • `+clearwarns` • `+clean`' },
        { name: '👥 Utilitaires', value: '`+ping` • `+say <message>` • `+userinfo <@user>` • `+serverinfo`' }
      );
    return message.channel.send({ embeds: [embed] });
  }

  // ===== PING =====
  if (cmd === 'ping') return message.channel.send('🏓 Pong !');

  // ===== SAY =====
  if (cmd === 'say') {
    const text = args.join(' ');
    if (!text) return message.reply('❌ Message manquant.');
    await message.delete().catch(() => {});
    return message.channel.send(text);
  }

  // ===== USERINFO =====
  if (cmd === 'userinfo') {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);

    const embed = new EmbedBuilder()
      .setTitle(`👤 Infos de ${user.tag}`)
      .setColor('#57F287')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot ?', value: user.bot ? '✅' : '❌', inline: true },
        { name: 'Roles', value: member.roles.cache.map(r => r).join(', '), inline: false }
      );
    return message.channel.send({ embeds: [embed] });
  }

  // ===== SERVERINFO =====
  if (cmd === 'serverinfo') {
    const embed = new EmbedBuilder()
      .setTitle(`🏰 Infos du serveur ${message.guild.name}`)
      .setColor('#FF0000')
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: message.guild.id, inline: true },
        { name: 'Membres', value: `${message.guild.memberCount}`, inline: true },
        { name: 'Propriétaire', value: `<@${message.guild.ownerId}>`, inline: true },
        { name: 'Rôles', value: `${message.guild.roles.cache.size}`, inline: true }
      );
    return message.channel.send({ embeds: [embed] });
  }

  // ===== CLEAN =====
  if (cmd === 'clean' || cmd === 'clear') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply('❌ Permission refusée.');
    const count = parseInt(args[0]);
    if (!count || count < 1 || count > 100) return message.reply('❌ Entre 1 et 100.');
    const deleted = await message.channel.bulkDelete(count, true);
    const msg = await message.channel.send(`🧹 ${deleted.size} messages supprimés.`);
    setTimeout(() => msg.delete().catch(() => {}), 4000);
  }

  // ===== KICK =====
  if (cmd === 'kick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Permission refusée.');
    const member = message.mentions.members.first();
    if (!member || !member.kickable) return message.reply('❌ Impossible.');
    await member.kick();
    message.channel.send(`👢 ${member.user.tag} expulsé.`);
    log(message.guild, `👢 ${member.user.tag} kick par ${message.author.tag}`);
  }

  // ===== BAN =====
  if (cmd === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Permission refusée.');
    const member = message.mentions.members.first();
    if (!member || !member.bannable) return message.reply('❌ Impossible.');
    await member.ban();
    message.channel.send(`⛔ ${member.user.tag} banni.`);
    log(message.guild, `⛔ ${member.user.tag} ban par ${message.author.tag}`);
  }

  // ===== PANEL =====
  if (cmd === 'panel') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ Admin seulement.');
    const embed = new EmbedBuilder()
      .setTitle('🎫 Centre de support')
      .setDescription('Clique sur un bouton pour ouvrir un ticket 👇')
      .setColor('#5865F2')
      .setFooter({ text: 'La Commu Chill' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_staff').setLabel('Gestion Staff').setEmoji('👮').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_abus').setLabel('Abus / Problèmes').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_question').setLabel('Question serveur').setEmoji('❓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_tech').setLabel('Technique / Absence').setEmoji('🛠️').setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== RENAME =====
  if (cmd === 'rename') {
    if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ Pas dans un ticket.');
    const newName = args.join('-');
    if (!newName) return message.reply(`❌ Utilisation: ${PREFIX}rename <nom>`);
    await message.channel.setName(`ticket-${newName}`);
    message.reply(`✏️ Ticket renommé en \`ticket-${newName}\``);
  }

  // ===== CLOSE =====
  if (cmd === 'close') {
    if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ Pas dans un ticket.');
    message.channel.send('🔒 Fermeture du ticket...');
    setTimeout(() => message.channel.delete().catch(() => {}), 3000);
  }
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = interaction.member;
  const typeMap = {
    ticket_staff: 'staff',
    ticket_abus: 'abus',
    ticket_question: 'question',
    ticket_tech: 'tech'
  };
  const type = typeMap[interaction.customId];
  if (!type) return;

  const existing = guild.channels.cache.find(c => c.name === `ticket-${type}-${member.user.username}`);
  if (existing) return interaction.editReply({ content: '❌ Tu as déjà un ticket ouvert.' });

  const channel = await guild.channels.create({
    name: `ticket-${type}-${member.user.username}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID || null,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: TICKET_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket ouvert')
    .setColor('#00FFB3')
    .setDescription(`👋 Bienvenue ${member}\nLe staff va te répondre rapidement.\n📌 Catégorie : **${type}**`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&${SUPPORT_ROLE_ID}>`, embeds: [embed], components: [row] });
  await interaction.editReply({ content: `✅ Ticket créé : ${channel}` });
});

// ====================== LOGIN ======================
client.login(TOKEN);