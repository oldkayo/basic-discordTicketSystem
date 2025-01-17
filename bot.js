const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const config = {
    token: "ODE0ODIwODI0MTM3MDcyNjUw.GBNvYJ.HkGO7VJb2gzwjzf0QO2sqNJbWxgB3pNdw04KLo",
    prefix: '!',
    ticketCategory: '1141611923327172709',
    staffRole: '953967572049604638',
    transcriptChannel: '1142964801526579200'
};

// Load configuration from file
function loadConfig() {
    try {
        const data = fs.readFileSync('config.json', 'utf8');
        const savedConfig = JSON.parse(data);
        Object.assign(config, savedConfig);
    } catch (error) {
        console.log('No saved configuration found');
    }
}

// Save configuration to file
function saveConfig() {
    const configToSave = {
        ticketCategory: config.ticketCategory,
        staffRole: config.staffRole,
        transcriptChannel: config.transcriptChannel
    };
    fs.writeFileSync('config.json', JSON.stringify(configToSave, null, 2));
}

// Load config when bot starts
loadConfig();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Create ticket button
client.on('messageCreate', async (message) => {
    if (message.content === `${config.prefix}setup-tickets`) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket System')
            .setDescription('Click the button below to create a ticket')
            .setColor('#0099ff');

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });
    }
});

// Handle ticket creation
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        // Check if user already has a ticket
        const existingTicket = interaction.guild.channels.cache.find(
            channel => channel.name === `ticket-${interaction.user.id}`
        );

        if (existingTicket) {
            return interaction.reply({
                content: 'You already have an open ticket!',
                ephemeral: true
            });
        }

        // Create new ticket channel
        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.id}`,
                type: ChannelType.GuildText,
                parent: config.ticketCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: config.staffRole,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const claimButton = new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Success);

            const addUserButton = new ButtonBuilder()
                .setCustomId('add_user')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Secondary);

            const transcriptButton = new ButtonBuilder()
                .setCustomId('transcript')
                .setLabel('Save Transcript')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(claimButton, addUserButton, transcriptButton, closeButton);

            const embed = new EmbedBuilder()
                .setTitle('Ticket Created')
                .setDescription(`Ticket created by ${interaction.user.toString()}`)
                .setColor('#00ff00')
                .addFields({ 
                    name: 'Please describe your issue', 
                    value: 'A staff member will be with you shortly.' 
                });

            await ticketChannel.send({
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({
                content: `Your ticket has been created: ${ticketChannel}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({
                content: 'There was an error creating your ticket. Please try again or contact an administrator.',
                ephemeral: true
            });
        }
    }

    // Handle ticket closing
    if (interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        
        if (!channel.name.startsWith('ticket-') && !channel.name.startsWith('claimed-')) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Ticket Closing')
            .setDescription('This ticket will be closed in 5 seconds...')
            .setColor('#ff0000');

        await interaction.reply({
            embeds: [embed]
        });

        setTimeout(async () => {
            await channel.delete();
        }, 5000);
    }

    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(config.staffRole)) {
            return interaction.reply({
                content: 'Only staff members can claim tickets!',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${interaction.user.toString()}`)
            .setColor('#00ff00');

        await interaction.reply({
            embeds: [embed]
        });

        await interaction.channel.setName(`claimed-${interaction.channel.name.split('-')[1]}`);
    }

    if (interaction.customId === 'add_user') {
        const modal = new ModalBuilder()
            .setCustomId('add_user_modal')
            .setTitle('Add User to Ticket');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('Enter the user ID or mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Create action row properly for modal
        const actionRow = new ActionRowBuilder().addComponents(userInput);
        modal.addComponents(new ActionRowBuilder().addComponents(userInput));

        try {
            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error showing modal:', error);
            await interaction.reply({
                content: 'There was an error with this action. Please try again.',
                ephemeral: true
            });
        }
    }

    if (interaction.customId === 'transcript') {
        await interaction.deferReply();

        try {
            const messages = await interaction.channel.messages.fetch();
            let transcript = `Transcript for ticket ${interaction.channel.name}\n\n`;

            messages.reverse().forEach(msg => {
                transcript += `${msg.author.tag} (${msg.createdAt.toLocaleString()}): ${msg.content}\n`;
            });

            const transcriptFile = new AttachmentBuilder(
                Buffer.from(transcript, 'utf-8'), 
                { name: `transcript-${interaction.channel.name}.txt` }
            );

            const transcriptChannel = interaction.guild.channels.cache.get(config.transcriptChannel);
            await transcriptChannel.send({
                content: `Transcript for ${interaction.channel.name}`,
                files: [transcriptFile]
            });

            await interaction.editReply({
                content: 'Transcript has been saved!',
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: 'There was an error saving the transcript!',
                ephemeral: true
            });
        }
    }
});

// Add modal submit handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'add_user_modal') {
        const userId = interaction.fields.getTextInputValue('user_id')
            .replace(/[<@!>]/g, ''); // Remove mention formatting if present

        try {
            const user = await interaction.guild.members.fetch(userId);
            await interaction.channel.permissionOverwrites.edit(user, {
                ViewChannel: true,
                SendMessages: true
            });

            await interaction.reply({
                content: `Added ${user.toString()} to the ticket!`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: 'Failed to add user. Please make sure the ID is valid.',
                ephemeral: true
            });
        }
    }
});

// After the config object, add a new command handler for creating the control panel
client.on('messageCreate', async (message) => {
    if (message.content === `${config.prefix}create-ticket-panel`) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        try {
            // Create a new channel for ticket controls
            const controlChannel = await message.guild.channels.create({
                name: 'ticket-control-panel',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: [PermissionFlagsBits.SendMessages],
                        allow: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: config.staffRole,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
                    }
                ]
            });

            // Create the main ticket panel embed
            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket System')
                .setDescription('Click the button below to create a new support ticket')
                .setColor('#0099ff')
                .addFields(
                    { name: 'Need Help?', value: 'Our support team is here to assist you!' },
                    { name: 'Rules:', value: '1. Be respectful\n2. Explain your issue clearly\n3. Be patient while waiting for response' }
                )
                .setFooter({ text: 'Support Ticket System' })
                .setTimestamp();

            // Create the open ticket button
            const openTicketButton = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Open a Ticket')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(openTicketButton);

            // Send the panel message
            await controlChannel.send({
                embeds: [ticketEmbed],
                components: [row]
            });

            // Create statistics embed
            const statsEmbed = new EmbedBuilder()
                .setTitle('📊 Ticket Statistics')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Active Tickets', value: '0', inline: true },
                    { name: 'Total Tickets', value: '0', inline: true },
                    { name: 'Last Updated', value: new Date().toLocaleString(), inline: true }
                );

            await controlChannel.send({
                embeds: [statsEmbed]
            });

            // Confirmation message
            await message.reply({
                content: `Ticket control panel has been created in ${controlChannel}!`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await message.reply({
                content: 'There was an error creating the ticket control panel!',
                ephemeral: true
            });
        }
    }
});

// Add a function to update ticket statistics (add this before client.login)
async function updateTicketStats(guild) {
    try {
        const controlChannel = guild.channels.cache.find(channel => channel.name === 'ticket-control-panel');
        if (!controlChannel) return;

        const statsMessage = (await controlChannel.messages.fetch({ limit: 10 }))
            .find(msg => msg.embeds[0]?.title === '📊 Ticket Statistics');
        if (!statsMessage) return;

        const activeTickets = guild.channels.cache.filter(channel => 
            channel.name.startsWith('ticket-') || channel.name.startsWith('claimed-')
        ).size;

        // You might want to store total tickets in a database
        // This is a simple implementation that only shows active tickets
        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 Ticket Statistics')
            .setColor('#00ff00')
            .addFields(
                { name: 'Active Tickets', value: activeTickets.toString(), inline: true },
                { name: 'Total Tickets', value: activeTickets.toString(), inline: true },
                { name: 'Last Updated', value: new Date().toLocaleString(), inline: true }
            );

        await statsMessage.edit({ embeds: [statsEmbed] });
    } catch (error) {
        console.error('Error updating ticket stats:', error);
    }
}

// Add these event listeners to update statistics when tickets are created or closed
client.on('channelCreate', async (channel) => {
    if (channel.name.startsWith('ticket-')) {
        await updateTicketStats(channel.guild);
    }
});

client.on('channelDelete', async (channel) => {
    if (channel.name.startsWith('ticket-') || channel.name.startsWith('claimed-')) {
        await updateTicketStats(channel.guild);
    }
});

// Add this after the other messageCreate handlers
client.on('messageCreate', async (message) => {
    if (message.content === `${config.prefix}ticket-help`) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket System Help')
            .setColor('#0099ff')
            .setDescription('Complete guide to the ticket system commands and features')
            .addFields(
                {
                    name: '🔧 Setup Commands',
                    value: `
\`${config.prefix}setup-tickets\` - Creates a simple ticket button in the current channel
\`${config.prefix}create-ticket-panel\` - Creates a dedicated ticket control panel with statistics
\`${config.prefix}ticket-config\` - Configure ticket system settings (category, staff role, etc.)
                    `
                },
                {
                    name: '🎫 Ticket Creation',
                    value: `
1️⃣ Use \`${config.prefix}setup-tickets\` in your desired channel
2️⃣ A button will appear for users to create tickets
3️⃣ Users click the button to create their support ticket
                    `
                },
                {
                    name: '👮 Staff Commands & Features',
                    value: `
**Claim Ticket** - Mark a ticket as being handled by you
**Add User** - Add additional users to the ticket
**Save Transcript** - Save the ticket conversation history
**Close Ticket** - Close and delete the ticket channel
                    `
                },
                {
                    name: '⚙️ Configuration',
                    value: `
• Set up ticket category
• Configure staff roles
• Set transcript channel
• Customize ticket permissions

Use \`${config.prefix}ticket-config\` to manage these settings
                    `
                },
                {
                    name: '📋 Ticket Guidelines',
                    value: `
• Create one ticket per issue
• Clearly describe your problem
• Be patient and respectful
• Follow staff instructions
• Don't spam new tickets
                    `
                },
                {
                    name: '🔍 Quick Setup Guide',
                    value: `
1. Use \`${config.prefix}ticket-config\` to set up roles and channels
2. Choose where to create ticket panel:
   • \`${config.prefix}setup-tickets\` for basic setup
   • \`${config.prefix}create-ticket-panel\` for advanced panel
3. Test the system by creating a ticket
                    `
                }
            )
            .setFooter({ text: `Use ${config.prefix}ticket-config to configure the system` })
            .setTimestamp();

        // Create buttons for quick actions
        const setupButton = new ButtonBuilder()
            .setCustomId('show_setup_guide')
            .setLabel('Setup Guide')
            .setEmoji('🔧')
            .setStyle(ButtonStyle.Primary);

        const configButton = new ButtonBuilder()
            .setCustomId('show_config')
            .setLabel('Configuration')
            .setEmoji('⚙️')
            .setStyle(ButtonStyle.Secondary);

        const supportButton = new ButtonBuilder()
            .setLabel('Support Server')
            .setURL('https://discord.gg/YOUR_SUPPORT_SERVER')
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder()
            .addComponents(setupButton, configButton, supportButton);

        await message.channel.send({
            embeds: [helpEmbed],
            components: [row]
        });
    }
});

// Add handlers for the new help buttons
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'show_setup_guide') {
        const setupEmbed = new EmbedBuilder()
            .setTitle('🔧 Ticket System Setup Guide')
            .setColor('#00ff00')
            .setDescription('Follow these steps to set up your ticket system')
            .addFields(
                {
                    name: '1️⃣ Initial Setup',
                    value: `
1. Create a category for tickets
2. Create a staff role
3. Create a channel for transcripts
                    `
                },
                {
                    name: '2️⃣ Configuration',
                    value: `
Use \`${config.prefix}ticket-config\` to configure:
• Ticket Category
• Staff Role
• Transcript Channel
                    `
                },
                {
                    name: '3️⃣ Create Ticket Panel',
                    value: `
Choose your preferred setup method:
• \`${config.prefix}setup-tickets\` - Basic ticket button
• \`${config.prefix}create-ticket-panel\` - Advanced panel with statistics
                    `
                },
                {
                    name: '4️⃣ Testing',
                    value: 'Test the system by creating a ticket and trying all features'
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [setupEmbed],
            ephemeral: true
        });
    }

    if (interaction.customId === 'show_config') {
        const configEmbed = new EmbedBuilder()
            .setTitle('⚙️ Configuration Guide')
            .setColor('#0099ff')
            .setDescription(`Use \`${config.prefix}ticket-config\` to access these settings`)
            .addFields(
                {
                    name: 'Current Settings',
                    value: `
🎫 Ticket Category: ${config.ticketCategory ? `<#${config.ticketCategory}>` : 'Not set'}
👮 Staff Role: ${config.staffRole ? `<@&${config.staffRole}>` : 'Not set'}
📝 Transcript Channel: ${config.transcriptChannel ? `<#${config.transcriptChannel}>` : 'Not set'}
                    `
                },
                {
                    name: 'How to Configure',
                    value: `
1. Use \`${config.prefix}ticket-config\`
2. Click the buttons to set each option
3. Enter the required IDs when prompted
                    `
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [configEmbed],
            ephemeral: true
        });
    }
});

// Add this after the config object
client.on('messageCreate', async (message) => {
    if (message.content.startsWith(`${config.prefix}ticket-config`)) {
        // Check if user has admin permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('You need Administrator permissions to use this command!');
        }

        const configEmbed = new EmbedBuilder()
            .setTitle('🛠️ Ticket System Configuration')
            .setColor('#0099ff')
            .setDescription('Click the buttons below to configure different aspects of the ticket system')
            .addFields(
                {
                    name: 'Current Configuration',
                    value: `
🎫 Ticket Category: ${config.ticketCategory ? `<#${config.ticketCategory}>` : 'Not set'}
👮 Staff Role: ${config.staffRole ? `<@&${config.staffRole}>` : 'Not set'}
📝 Transcript Channel: ${config.transcriptChannel ? `<#${config.transcriptChannel}>` : 'Not set'}
                    `
                }
            )
            .setFooter({ text: 'Click the buttons below to update settings' });

        const categoryButton = new ButtonBuilder()
            .setCustomId('set_category')
            .setLabel('Set Ticket Category')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary);

        const staffButton = new ButtonBuilder()
            .setCustomId('set_staff_role')
            .setLabel('Set Staff Role')
            .setEmoji('👮')
            .setStyle(ButtonStyle.Success);

        const transcriptButton = new ButtonBuilder()
            .setCustomId('set_transcript')
            .setLabel('Set Transcript Channel')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(categoryButton, staffButton, transcriptButton);

        await message.channel.send({
            embeds: [configEmbed],
            components: [row]
        });
    }
});

// Add this to your interactionCreate event handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Handle configuration buttons
    if (['set_category', 'set_staff_role', 'set_transcript'].includes(interaction.customId)) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'You need Administrator permissions to configure the ticket system!',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_${interaction.customId}`)
            .setTitle('Ticket System Configuration');

        let inputLabel, inputPlaceholder;
        switch (interaction.customId) {
            case 'set_category':
                inputLabel = 'Ticket Category ID';
                inputPlaceholder = 'Enter the category ID where tickets will be created';
                break;
            case 'set_staff_role':
                inputLabel = 'Staff Role ID';
                inputPlaceholder = 'Enter the role ID for staff members';
                break;
            case 'set_transcript':
                inputLabel = 'Transcript Channel ID';
                inputPlaceholder = 'Enter the channel ID for ticket transcripts';
                break;
        }

        const input = new TextInputBuilder()
            .setCustomId('config_input')
            .setLabel(inputLabel)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(inputPlaceholder)
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(input);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }
});

// Add this to handle modal submissions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('modal_set_')) {
        const inputValue = interaction.fields.getTextInputValue('config_input');

        try {
            let successMessage = '';
            let configKey = '';

            switch (interaction.customId) {
                case 'modal_set_category':
                    const category = await interaction.guild.channels.fetch(inputValue);
                    if (!category || category.type !== ChannelType.GuildCategory) {
                        throw new Error('Invalid category ID');
                    }
                    config.ticketCategory = inputValue;
                    configKey = 'ticketCategory';
                    successMessage = `Ticket category has been set to ${category.name}`;
                    break;

                case 'modal_set_staff_role':
                    const role = await interaction.guild.roles.fetch(inputValue);
                    if (!role) {
                        throw new Error('Invalid role ID');
                    }
                    config.staffRole = inputValue;
                    configKey = 'staffRole';
                    successMessage = `Staff role has been set to ${role.name}`;
                    break;

                case 'modal_set_transcript':
                    const channel = await interaction.guild.channels.fetch(inputValue);
                    if (!channel || channel.type !== ChannelType.GuildText) {
                        throw new Error('Invalid channel ID');
                    }
                    config.transcriptChannel = inputValue;
                    configKey = 'transcriptChannel';
                    successMessage = `Transcript channel has been set to ${channel.name}`;
                    break;
            }

            // You might want to save these configurations to a database
            // For now, they'll reset when the bot restarts

            // Save configuration after successful update
            saveConfig();

            const embed = new EmbedBuilder()
                .setTitle('✅ Configuration Updated')
                .setColor('#00ff00')
                .setDescription(successMessage)
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Configuration Error')
                .setColor('#ff0000')
                .setDescription(`Failed to update configuration: ${error.message}`)
                .setTimestamp();

            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    }
});

client.login(config.token);
