const { Client, MessageEmbed, TextChannel, Guild, MessageReaction } = require('discord.js')
const client = new Client({ retryLimit: Infinity })
const settings = require('../settings.json')
/** @type Guild */ let cupGuild
const db = require('better-sqlite3')('./cup.db')
db.exec('CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, cups INT NOT NULL, legendaries INT NOT NULL, prestige INT NOT NULL);')
const nomar = require('nomar')

/**
 * Limits a number to between two values.
 * @param {Number} value The number to clamp
 * @param {Number} min Minimum value
 * @param {Number} max Maximum value
 */
const clamp = (value, min, max) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Ensures there's a row in the table for the user.
 * @param {String} id User ID to ensure exists.
 */
function ensureUserExists (id) {
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?);').run(id)
}

/**
 * Adds a cup to a user.
 * @param {String} id User ID to add cup to.
 * @param {Boolean} isLegendary Is the cup legendary?
 */
function addCup (id, isLegendary) {
  db.prepare('INSERT OR IGNORE INTO users (id, cups, legendaries) VALUES (?, ?, ?);').run(id, isLegendary ? 0 : 1, isLegendary ? 1 : 0)
  isLegendary ? db.prepare('UPDATE users SET legendaries = legendaries + 1 WHERE id = ?;').run(id) : db.prepare('UPDATE users SET cups = cups + 1 WHERE id = ?').run(id)

  const member = cupGuild.member(client.users.cache.get(id))
  const memberCups = getCups(id).cups
  switch (memberCups) {
    case 100:
      if (!member.roles.cache.get(settings.cupRoles[100])) member.roles.add(settings.cupRoles[100])
      break
    case 1000:
      if (!member.roles.cache.get(settings.cupRoles['1,000'])) member.roles.add(settings.cupRoles['1,000'])
      break
    case 10000:
      if (!member.roles.cache.get(settings.cupRoles['10,000'])) member.roles.add(settings.cupRoles['10,000'])
      break
    case 100000:
      if (!member.roles.cache.get(settings.cupRoles['100,000'])) member.roles.add(settings.cupRoles['100,000'])
      break
    case 1000000:
      if (!member.roles.cache.get(settings.cupRoles['1,000,000'])) member.roles.add(settings.cupRoles['1,000,000'])
      break
  }
}

/**
 * Get cup amount of a user.
 * @param {String} id User ID to check cups of.
 */
function getCups (id) {
  ensureUserExists(id)
  return db.prepare('SELECT cups, legendaries FROM users WHERE id = ?;').get(id)
}

/**
 * Get prestige rank of a user.
 * @param {String} id User ID to check prestige of.
 */
function getPrestige (id) {
  ensureUserExists(id)
  const member = cupGuild.member(client.users.cache.get(id))
  for (const role of Array.from(member.roles.cache.values()).reverse()) {
    if (nomar(role.name.split(' ')[1]) !== undefined) {
      return nomar(role.name.split(' ')[1])
    }
  }
  return 0
}

/**
 * Increment a user's prestige rank.
 * @param {String} id User ID to increase prestige rank of.
 */
async function prestige (id) {
  ensureUserExists(id)
  const member = cupGuild.member(client.users.cache.get(id))

  const currentPrestige = getPrestige(id)
  db.prepare('UPDATE users SET cups = 0, legendaries = 0, prestige = ? WHERE id = ?;').run(clamp(currentPrestige + 1, 1, 5), id)
  member.roles.add(await cupGuild.roles.fetch(settings.prestigeRoles[clamp(currentPrestige + 1, 1, 5)]))
  member.roles.remove([
    settings.cupRoles[100], settings.cupRoles['1,000'], settings.cupRoles['10,000'], settings.cupRoles['100,000'], settings.cupRoles['1,000,000'],
    settings.upgrades.colours['🧡'].role, settings.upgrades.colours['💚'].role, settings.upgrades.colours['💙'].role,
    settings.upgrades.colours['🧡'].role, settings.upgrades.colours['💛'].role, settings.upgrades.colours['💜'].role
  ]).catch(() => { /* guess they didn't have those roles lol */ })

  return clamp(currentPrestige + 1, 1, 5)
}

/**
 * Give a user an upgrade.
 * @param {String} id User ID to give upgrade to
 * @param {Object} upgrade THe upgrade to give
 * @param {String} reaction The name of the reaction used
 */
// async function upgrade (id, upgrade, reaction) {
//   console.log(`Upgrading ${id} with upgrade ${upgrade.role} which costs ${upgrade.price}, triggered by ${reaction}.`)
// }

// const ShopEmbeds = [
//   new MessageEmbed({
//     title: 'Cup Modifiers (cupgrades)!',
//     description: 'Spend legendary cups to speed up your cup income! 😳\nAll modifiers are lost when you prestige. Each level of a given modifier must be bought for the next to be available.',
//     color: 0xEEEEEE
//   }),
//   new MessageEmbed({
//     title: '🍀 Luck of the Cup',
//     description: 'Each level grants an added chance of earning two cups when saying **cup**.',
//     fields: [
//       {
//         name: 'Level 1',
//         value: '**1**LC\n1% chance.',
//         inline: true
//       },
//       {
//         name: 'Level 2',
//         value: '**1**LC\n2% chance.',
//         inline: true
//       },
//       {
//         name: 'Level 3',
//         value: '**2**LC\n4% chance.',
//         inline: true
//       },
//       {
//         name: 'Level 4',
//         value: '**3**LC\n7% chance.',
//         inline: true
//       },
//       {
//         name: 'Level 5',
//         value: '**3**LC\n10% chance.',
//         inline: true
//       },
//       {
//         name: '_ _',
//         value: '_ _',
//         inline: true
//       }
//     ],
//     color: 0x00FFA5
//   }),
//   new MessageEmbed({
//     title: '🌈 Colours!',
//     description: 'Buy yourself a custom colour to stand out from the other cups!\nAll colours cost **5**LC.',
//     color: 0xFFA500
//   })
// ]

// const ShopEmbedReactions = [[], ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'], ['❤', '💛', '💙', '💚', '🧡', '💜']]

const PrestigeEmbed = new MessageEmbed({
  title: 'Cup Prestige!',
  description: 'Start fresh, but earn more legendary cups as a bonus!',
  fields: [
    {
      name: 'How many cups do I need to prestige?',
      value: 'You need at least 1,000,000 cups to prestige.\nNote that there are no added bonuses for prestiging with more cups. 1,000,000 is the flat rate.'
    },
    {
      name: 'What do I get from prestige?',
      value: 'Without prestige, the chance of getting a legendary cup is about 0.1%, or 1/1000. For every prestige, this chance increases by an extra 0.1%.\nFor example, at Prestige V, you would be at 0.6%, which equates to about 1/166.\n\nEach prestige gets a stronger role colour and higher place in the member list!'
    }
  ],
  footer: {
    text: 'By clicking the reaction below, you will prestige instantly, provided you have the cups.'
  },
  color: 0xFFA500
})

client.on('ready', () => {
  console.log(`Online as ${client.user.tag}`)
  client.user.setActivity('with Jowsey 😔')
  cupGuild = client.guilds.cache.get('YOUR GUILD ID')

  // CHANGE THESE VALUES (IDs)
  // note the shop channel doesn't work yet
  /** @type TextChannel */ const prestigeChannel = client.channels.cache.get('PRESTIGE CHANNEL ID')
  // /** @type TextChannel */ const shopChannel = client.channels.cache.get('SHOP CHANNEL ID')

  prestigeChannel.messages.fetch().then(async messages => {
    let embed = messages.last()
    if (!embed) {
      await prestigeChannel.send(PrestigeEmbed).then(prestigeMessage => {
        embed = prestigeMessage
        embed.react('⬆')
      })
    }

    // TODO: don't think this actually works lol it always edits
    if (embed.embeds[0] !== PrestigeEmbed) {
      embed.edit(PrestigeEmbed)
    }
    const prestigeCollector = embed.createReactionCollector((reaction, user) => reaction.emoji.name === '⬆')

    prestigeCollector.on('collect', async (reaction, user) => {
      if (user.bot) return
      const userCups = getCups(user.id).cups
      if (userCups >= 1000000) {
        prestigeChannel.send(`**Congratulations to ${user} for unlocking Prestige ${await prestige(user.id)}!**`).then(m => {
          setTimeout(() => {
            m.delete()
          }, 300000)
        })
      } else {
        prestigeChannel.send(`${user}, you don't have enough cups to prestige.`).then(m => {
          setTimeout(() => {
            m.delete()
          }, 5000)
        })
      }
    })
  })

  //   shopChannel.messages.fetch().then(async embeds => {
  //     if (embeds.size !== ShopEmbeds.length) {
  //       embeds.forEach(embed => {
  //         embed.delete()
  //       })
  //       const shopEmbedMessages = []
  //       ShopEmbeds.forEach(ShopEmbed => {
  //         shopChannel.send(ShopEmbed).then(m => shopEmbedMessages.push(m.id))
  //       })
  //       embeds = await shopChannel.messages.fetch()
  //     }

  //     let i = 0
  //     const shopCollectors = []
  //     Array.from(embeds.values()).reverse().forEach(embed => {
  //       if (embed.content !== ShopEmbeds[i]) {
  //         embed.edit(ShopEmbeds[i])
  //       }
  //       const embedReactions = []
  //       Array.from(embed.reactions.cache.values()).forEach(reaction => {
  //         embedReactions.push(reaction.emoji.name)
  //       })
  //       if (JSON.stringify(embedReactions) !== JSON.stringify(ShopEmbedReactions[i])) {
  //         embed.reactions.removeAll()
  //         ShopEmbedReactions[i].forEach(reaction => {
  //           embed.react(reaction)
  //         })
  //       }

  //       console.log(ShopEmbedReactions, '\n', i, ShopEmbedReactions[i])

  //       // 0 is the first embed which is the title embed and has no reactions
  //       if (i !== 0) {
  //         shopCollectors.push(embed.createReactionCollector((reaction, user) => ShopEmbedReactions[i].includes(reaction.emoji.name)))
  //         shopCollectors[i - 1].on('collect', async (reaction, user) => {
  //           if (user.bot) return
  //           const userLegendaries = getCups(user.id).legendaries
  //           const upgradeReactions = Object.keys(settings.upgrades.colours).concat(Object.keys(settings.upgrades.luckOfTheCup))
  //           if (upgradeReactions.includes(reaction.emoji.name)) {
  //             const upgradePrice = upgradeReactions[reaction.emoji.name]
  //             if (userLegendaries >= upgradePrice) {
  //               upgrade(user.id, upgradeReactions[reaction.emoji.name], reaction.emoji.name)
  //             }
  //           }
  //         })
  //       }
  //    i++
  //    })
  // })
})

client.on('message', message => {
  if (message.author.bot) return
  switch (message.channel.name) {
    case 'cup':
      if (message.content.toLowerCase().trim() !== 'cup') {
        message.reply('you fool. you absolute buffoon. you think you can challenge me in my own realm? you think you can rebel against my authority? you dare come into my house and upturn my dining chairs and spill coffee grounds in my Keurig? you thought you were safe in your chain mail armor behind that screen of yours. I will take these laminate wood floor boards and destroy you. I didn’t want war. but i didn’t start it.\n\nIt is illegal to say anything but **cup** in this server.')
          .then(res => {
            setTimeout(() => {
              res.delete()
            }, 7500)
          })
          .catch(e => {
            // i don't even know if this works, never got an error, never will 😎
            // ok but fr i should test if this is actually how you use catch lol
            console.log("AYOO WTF WHY CAN'T I DO MY SHIT I GOT THIS MF ERROR", e.toString())
          })
        message.delete()
      } else {
        const legendaryDieSides = 100 / (0.1 + 0.1 * getPrestige(message.author.id))
        // Generates anywhere from 0 to (eg) 166. Returns true if it's between, for example, 165 and 166.
        const legendaryRoll = Math.random() * legendaryDieSides >= legendaryDieSides - 1
        addCup(message.author.id, legendaryRoll)
        if (legendaryRoll) message.reply('you got a legendary cup!')
      }
      break
    case 'cups':
      if (message.content.toLowerCase().trim() !== 'cups') {
        message.reply('you can only say **cups** in this channel.')
        message.delete()
      } else {
        const info = getCups(message.author.id)
        message.reply(`you have **${info.cups}** cups and **${info.legendaries}** legendary cups.`)
      }
      break
    // case 'shop':
    //   if (message.author.bot) return
    //   addCup(message.author.id, true)
    //   addCup(message.author.id, true)
    //   addCup(message.author.id, true)
    //   addCup(message.author.id, true)
    //   addCup(message.author.id, true)
    //   message.delete()
    //   console.log('You now have', getCups(message.author.id).legendaries, 'legendaries.')
    //   break
  }
})

// client.on('guildMemberAdd', member => {
//   // CHANGE THESE VALUES
//   // roles for the "cult" role. feel free to delete this
//   if (member.guild.id === '765352620117983242') {
//     member.roles.add('765645490569347143')
//   }
// })

client.on('messageUpdate', (old, message) => {
  if (message.content !== 'cup' && message.channel.name === 'cup') {
    message.delete()
  }
})

client.login(settings.token)
