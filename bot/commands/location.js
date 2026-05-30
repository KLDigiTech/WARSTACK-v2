const { SlashCommandBuilder } = require('discord.js');
const supabase                = require('../services/supabase');

// Données pays avec drapeaux et coordonnées par défaut
const COUNTRIES = {
  'France'       : { flag: '🇫🇷', lat: 46.5,  lng: 2.5   },
  'Belgique'     : { flag: '🇧🇪', lat: 50.5,  lng: 4.5   },
  'Suisse'       : { flag: '🇨🇭', lat: 46.8,  lng: 8.2   },
  'Canada'       : { flag: '🇨🇦', lat: 56.0,  lng: -96.0 },
  'Maroc'        : { flag: '🇲🇦', lat: 31.8,  lng: -7.0  },
  'Algérie'      : { flag: '🇩🇿', lat: 28.0,  lng: 3.0   },
  'Tunisie'      : { flag: '🇹🇳', lat: 33.9,  lng: 9.5   },
  'États-Unis'   : { flag: '🇺🇸', lat: 37.0,  lng: -95.0 },
  'Royaume-Uni'  : { flag: '🇬🇧', lat: 55.0,  lng: -3.0  },
  'Allemagne'    : { flag: '🇩🇪', lat: 51.0,  lng: 10.0  },
  'Espagne'      : { flag: '🇪🇸', lat: 40.0,  lng: -4.0  },
  'Italie'       : { flag: '🇮🇹', lat: 42.5,  lng: 12.5  },
  'Portugal'     : { flag: '🇵🇹', lat: 39.5,  lng: -8.0  },
  'Pays-Bas'     : { flag: '🇳🇱', lat: 52.3,  lng: 5.3   },
  'Australie'    : { flag: '🇦🇺', lat: -25.0, lng: 133.0 },
  'Brésil'       : { flag: '🇧🇷', lat: -10.0, lng: -55.0 },
  'Mexique'      : { flag: '🇲🇽', lat: 23.0,  lng: -102.0},
};

// Coordonnées approximatives des villes françaises
const FRENCH_CITIES = {
  'paris'       : { lat: 48.8566, lng: 2.3522,  region: 'Île-de-France'    },
  'marseille'   : { lat: 43.2965, lng: 5.3698,  region: 'PACA'             },
  'lyon'        : { lat: 45.7640, lng: 4.8357,  region: 'Auvergne-Rhône-Alpes' },
  'toulouse'    : { lat: 43.6047, lng: 1.4442,  region: 'Occitanie'        },
  'nice'        : { lat: 43.7102, lng: 7.2620,  region: 'PACA'             },
  'nantes'      : { lat: 47.2184, lng: -1.5536, region: 'Pays de la Loire' },
  'montpellier' : { lat: 43.6110, lng: 3.8767,  region: 'Occitanie'        },
  'strasbourg'  : { lat: 48.5734, lng: 7.7521,  region: 'Grand Est'        },
  'bordeaux'    : { lat: 44.8378, lng: -0.5792, region: 'Nouvelle-Aquitaine'},
  'lille'       : { lat: 50.6292, lng: 3.0573,  region: 'Hauts-de-France'  },
  'rennes'      : { lat: 48.1173, lng: -1.6778, region: 'Bretagne'         },
  'reims'       : { lat: 49.2583, lng: 4.0317,  region: 'Grand Est'        },
  'toulon'      : { lat: 43.1242, lng: 5.9280,  region: 'PACA'             },
  'grenoble'    : { lat: 45.1885, lng: 5.7245,  region: 'Auvergne-Rhône-Alpes' },
  'dijon'       : { lat: 47.3220, lng: 5.0415,  region: 'Bourgogne-Franche-Comté' },
  'angers'      : { lat: 47.4784, lng: -0.5632, region: 'Pays de la Loire' },
  'nîmes'       : { lat: 43.8367, lng: 4.3601,  region: 'Occitanie'        },
  'villeurbanne': { lat: 45.7676, lng: 4.8796,  region: 'Auvergne-Rhône-Alpes' },
  'saint-étienne':{ lat: 45.4397, lng: 4.3872,  region: 'Auvergne-Rhône-Alpes' },
  'le havre'    : { lat: 49.4938, lng: 0.1077,  region: 'Normandie'        },
  'amiens'      : { lat: 49.8941, lng: 2.2958,  region: 'Hauts-de-France'  },
  'clermont-ferrand': { lat: 45.7772, lng: 3.0870, region: 'Auvergne-Rhône-Alpes' },
  'tours'       : { lat: 47.3941, lng: 0.6848,  region: 'Centre-Val de Loire' },
  'limoges'     : { lat: 45.8354, lng: 1.2644,  region: 'Nouvelle-Aquitaine'},
  'besançon'    : { lat: 47.2378, lng: 6.0241,  region: 'Bourgogne-Franche-Comté' },
  'metz'        : { lat: 49.1193, lng: 6.1757,  region: 'Grand Est'        },
  'perpignan'   : { lat: 42.6987, lng: 2.8956,  region: 'Occitanie'        },
  'caen'        : { lat: 49.1829, lng: -0.3707, region: 'Normandie'        },
  'brest'       : { lat: 48.3904, lng: -4.4861, region: 'Bretagne'         },
  'rouen'       : { lat: 49.4432, lng: 1.0993,  region: 'Normandie'        },
  'lunel'       : { lat: 43.6760, lng: 4.1358,  region: 'Occitanie'        },
  'narbonne'    : { lat: 43.1836, lng: 3.0042,  region: 'Occitanie'        },
  'montauban'   : { lat: 44.0181, lng: 1.3528,  region: 'Occitanie'        },
  'albi'        : { lat: 43.9279, lng: 2.1479,  region: 'Occitanie'        },
  'pau'         : { lat: 43.2951, lng: -0.3708, region: 'Nouvelle-Aquitaine'},
  'bayonne'     : { lat: 43.4929, lng: -1.4748, region: 'Nouvelle-Aquitaine'},
  'avignon'     : { lat: 43.9493, lng: 4.8055,  region: 'PACA'             },
  'aix-en-provence': { lat: 43.5297, lng: 5.4474, region: 'PACA'           },
  'cannes'      : { lat: 43.5528, lng: 7.0174,  region: 'PACA'             },
  'antibes'     : { lat: 43.5804, lng: 7.1253,  region: 'PACA'             },
  'mulhouse'    : { lat: 47.7508, lng: 7.3359,  region: 'Grand Est'        },
  'nancy'       : { lat: 48.6921, lng: 6.1844,  region: 'Grand Est'        },
  'orléans'     : { lat: 47.9029, lng: 1.9039,  region: 'Centre-Val de Loire' },
  'valenciennes': { lat: 50.3578, lng: 3.5236,  region: 'Hauts-de-France'  },
  'dunkerque'   : { lat: 51.0343, lng: 2.3768,  region: 'Hauts-de-France'  },
};

function getCityCoords(city, country) {
  if (country !== 'France') {
    const c = COUNTRIES[country];
    return c ? { lat: c.lat, lng: c.lng, region: null } : null;
  }
  const key = city.toLowerCase().trim();
  return FRENCH_CITIES[key] || { lat: 46.5, lng: 2.5, region: null };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('location')
    .setDescription('📍 Gère ta localisation sur la carte des membres')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Enregistre ta localisation')
        .addStringOption(o =>
          o.setName('pays')
            .setDescription('Ton pays')
            .setRequired(true)
            .addChoices(
              ...Object.keys(COUNTRIES).map(c => ({ name: `${COUNTRIES[c].flag} ${c}`, value: c }))
            )
        )
        .addStringOption(o =>
          o.setName('ville')
            .setDescription('Ta ville (optionnel)')
            .setRequired(false)
        )
        .addStringOption(o =>
          o.setName('region')
            .setDescription('Ta région (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Supprimer ta localisation')
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Voir ta localisation enregistrée')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── SET ───────────────────────────────────────────────
    if (sub === 'set') {
      const country = interaction.options.getString('pays');
      const city    = interaction.options.getString('ville') || null;
      const region  = interaction.options.getString('region') || null;

      const countryData = COUNTRIES[country];
      if (!countryData) {
        return interaction.reply({ content: '❌ Pays invalide.', ephemeral: true });
      }

      // Coordonnées
      let lat = countryData.lat;
      let lng = countryData.lng;
      let detectedRegion = region;

      if (city) {
        const coords = getCityCoords(city, country);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          if (!detectedRegion && coords.region) detectedRegion = coords.region;
        }
      }

      const { error } = await supabase
        .from('member_locations')
        .upsert({
          discord_id: interaction.user.id,
          username  : interaction.user.username,
          country,
          city      : city || null,
          region    : detectedRegion || null,
          lat,
          lng,
          flag      : countryData.flag,
        }, { onConflict: 'discord_id' });

      if (error) {
        return interaction.reply({ content: '❌ Erreur lors de l\'enregistrement.', ephemeral: true });
      }

      const locationStr = [city, detectedRegion, country].filter(Boolean).join(', ');
      return interaction.reply({
        content : `✅ Localisation enregistrée : ${countryData.flag} **${locationStr}**`,
        ephemeral: true
      });
    }

    // ── DELETE ────────────────────────────────────────────
    if (sub === 'delete') {
      await supabase
        .from('member_locations')
        .delete()
        .eq('discord_id', interaction.user.id);

      return interaction.reply({
        content : '✅ Ta localisation a été supprimée.',
        ephemeral: true
      });
    }

    // ── VIEW ──────────────────────────────────────────────
    if (sub === 'view') {
      const { data } = await supabase
        .from('member_locations')
        .select('*')
        .eq('discord_id', interaction.user.id)
        .single();

      if (!data) {
        return interaction.reply({
          content : '❌ Tu n\'as pas enregistré ta localisation. Utilise `/location set`.',
          ephemeral: true
        });
      }

      const locationStr = [data.city, data.region, data.country].filter(Boolean).join(', ');
      return interaction.reply({
        content : `📍 Ta localisation : ${data.flag} **${locationStr}**`,
        ephemeral: true
      });
    }
  }
};