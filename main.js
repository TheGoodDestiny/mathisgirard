// Here is the main.js, be carrefull of other commands when editing here.
const Discord = require("discord.js");
const fs = require("fs");
const client = new Discord.Client();
const config = require("./config.json");
const usermap = new Map();
const mongo = require("./mongo");
const warnSchema = require("./schemas/warn-schema");

client.config = config; // Acceder

fs.readdir("./events", (err, files) => {
  // On regarde tout ce qu'il y a dans le dossier "events"
  if (err) return console.log(err); // On regarde si y a une erreur
  files.forEach((files) => {
    // On fait ça pour chaque élément
    const event = require(`./events/${files}`); // On prend le fichier
    const eventName = files.split(".")[0]; // On garde que le nom
    client.on(eventName, event.bind(null, client)); // On lance l'event
  });
});

client.commands = new Discord.Collection();

fs.readdir("./commands", (err, files) => {
  const filter = files.filter((f) => f.split(".").pop() === "js");
  if (filter.length <= 0) return console.log("Aucune commande trouvé");

  if (err) return console.log(err); // Look at error
  filter.forEach((files) => {
    const props = require(`./commands/${files}`); // On prend le fichier
    console.log(`Lancement de ${files}`);
    client.commands.set(props.help.name, props); // On fait en sorte de pouvoir utiliser la commande
  });
});

module.exports.getUserFromMention = function (
  mention,
  message = false,
  all = false
) {
  if (!mention) return false;
  if (all) {
    return message.mentions.members;
  }
  if (mention.startsWith("<@") && mention.endsWith(">")) {
    mention = mention.slice(2, -1);

    if (mention.startsWith("!")) {
      mention = mention.slice(1);
    }
    if (!message) {
      return client.users.cache.get(mention);
    }
  }
  if (message) {
    return message.guild.members.cache.find(
      (id) =>
        id.id === mention ||
        id.user.username.toLowerCase().startsWith(mention.toLowerCase()) ||
        id.displayName.toLowerCase().startsWith(mention.toLowerCase())
    );
  }
};

module.exports.getMoreUsersFromMention = function (mention, message) {
  if (mention.includes(",")) {
    mention = mention.split(",");
    const array = [];
    mention.forEach((element) => {
      if (this.getUserFromMention(element, message) !== undefined) {
        array.push(this.getUserFromMention(element, message));
      }
    });
    return array;
  } else {
    return this.getUserFromMention(mention, message);
  }
};
module.exports.getChannelFromMention = function (mention) {
  if (!mention) return false;

  if (mention.startsWith("<#") && mention.endsWith(">")) {
    mention = mention.slice(2, -1);

    return client.channels.cache.get(mention);
  }
};

module.exports.getmembersbyroles = function (role, message) {
  if (!role) return false;

  if (role.startsWith("<@&") && role.endsWith(">")) {
    role = role.slice(3, -1);

    const array = [];
    message.guild.members.cache.forEach((member) => {
      if (member.roles.cache.has(role)) {
        array.push(member);
      }
    });
    return array;
  }
};

module.exports.usermap = usermap;

module.exports.mute = async function (client, message, member) {
  let muterole = message.guild.roles.cache.find(
    (role) => role.name === "muted")

  if (!muterole) {
    try {
      muterole = await message.guild.roles.create({
        data: { name: "muted", permissions: [] },
      });
      message.guild.channels.cache.forEach(async (channel) => {
        await channel.createOverwrite(muterole, {
          SEND_MESSAGES: false,
          ADD_REACTIONS: false,
        });
      });
    } catch (e) {
      console.log(e);
      message.channel
        .send(
          "**⚠️ Je n'ai pas la permission modifier les salons et/ou de créer des roles. ⚠️** "
        )
        .then((msg) => {
          msg.delete({ timeout: 5000 });
        });
      throw e;
    }
  }
  try {
    await member.roles.add(muterole);
    return muterole;
  } catch (error) {
    message.channel
      .send('**Je n\'ai as la permission de de mettre le rôle "muted" 🤒 !**')
      .then((msg) => {
        msg.delete({ timeout: 5000 });
      });
    throw error;
  }
}
/**
* Cette fonction permet de warn quelqu'un
* @param {Discord.Client} client Un client discord
* @param {Discord.Message} message un message
* @param {String} qui N'importe quoi qui permet d'identifier un utilisateur
* @param {String} raison Une raison de warn
* @param {Discord.GuildMember} author Auteur du warn
* @returns {Boolean} Retourne si le warn à fonctionné ou pas
*/

module.exports.warn = async function (
  client,
  message,
  qui,
  raison,
  author = message.member.user.id
) {
  if (Array.isArray(qui) === true) {
    qui.forEach(async (element) => {
      const guildID = message.guild.id;
      const memberID = element.id;
      let ticket = "";
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const charactersLength = characters.length;
      for (let i = 0; i < 6; i++) {
        ticket += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      const warning = {
        author,
        timestamp: new Date().getTime(),
        ticket,
        raison,
      };
      let tocheck = true;

      await mongo().then(async (mongoose) => {
        try {
          await warnSchema.findOneAndUpdate(
            {
              guildID,
              memberID,
            },
            {
              guildID,
              memberID,
              $push: {
                warnings: warning,
              },
            },
            {
              upsert: true,
            }
          );
        } catch (error) {
          tocheck = false;
        } finally {
          mongoose.connection.close();
        }
      });

      if (tocheck === false) return false;

      const embed = new Discord.MessageEmbed()
        .setTitle(`Avertissement ${ticket}`)
        .setAuthor(
          `${message.guild.name}`,
          `${message.guild.iconURL({ format: "png" })}`
        )
        .setColor(16729600)
        .setDescription(`Vous venez d'être averti : **${raison}**`)
        .setFooter(
          "Veillez à ne pas être trop averti",
          "https://i.gyazo.com/760fd534c0513e6f336817c759afa005.png"
        )
        .setImage(
          "https://i0.wp.com/northmantrader.com/wp-content/uploads/2020/02/WARNING.gif?ssl=1"
        )
        .setTimestamp();

      element.send(embed);
    });
    return true;
  } else {
    const guildID = message.guild.id;
    const memberID = qui.id;
    let ticket = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const charactersLength = characters.length;
    for (let i = 0; i < 6; i++) {
      ticket += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    const warning = {
      author,
      timestamp: new Date().getTime(),
      ticket,
      raison,
    };
    let tocheck = true;

    await mongo().then(async (mongoose) => {
      try {
        await warnSchema.findOneAndUpdate(
          {
            guildID,
            memberID,
          },
          {
            guildID,
            memberID,
            $push: {
              warnings: warning,
            },
          },
          {
            upsert: true,
          }
        );
      } catch (error) {
        tocheck = false;
      } finally {
        mongoose.connection.close();
      }
    });

    if (tocheck === false) return false;

    const embed = new Discord.MessageEmbed()
      .setTitle(`Avertissement ${ticket}`)
      .setAuthor(
        `${message.guild.name}`,
        `${message.guild.iconURL({ format: "png" })}`
      )
      .setColor(16729600)
      .setDescription(`Vous venez d'être averti : **${raison}**`)
      .setFooter(
        "Veillez à ne pas être trop averti",
        "https://i.gyazo.com/760fd534c0513e6f336817c759afa005.png"
      )
      .setImage(
        "https://i0.wp.com/northmantrader.com/wp-content/uploads/2020/02/WARNING.gif?ssl=1"
      )
      .setTimestamp();

    qui.send(embed);
    return true;
  }
};
client.login(config.token);
