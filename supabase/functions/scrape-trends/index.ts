import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTrendsData {
  keyword: string;
  value: number;
}

interface TrendWithHistory {
  name: string;
  description: string;
  tags: string[];
  source: string;
  popularity_score: number;
  history?: { date: string; score: number }[];
}

interface TikTokTrendItem {
  hashtag?: string;
  description?: string;
  viewCount?: number;
  videoCount?: number;
  tags?: string[];
}

async function scrapeTrendsFromTikTok(): Promise<any[]> {
  try {
    console.log('Starting TikTok scrape...');
    
    const fashionHashtags = [
      // Core fashion (50+)
      'fashion', 'ootd', 'style', 'fashiontrends', 'fashioninspo', 'styleinspo', 'outfitideas', 'fashionista', 'fashionable', 'fashionblogger',
      'fashionweek', 'fashiondesign', 'fashionphotography', 'fashionmodel', 'fashionaddict', 'fashionlover', 'fashiondiaries', 'fashionpost',
      'fashiongoals', 'fashiondaily', 'fashiongram', 'fashionlife', 'fashionstyle', 'fashionblog', 'fashionart', 'fashionicon', 'fashionforward',
      'fashioninspiration', 'fashionphotographer', 'fashiondesigner', 'fashioneditorial', 'fashionshoot', 'fashionlook', 'fashionstatement',
      'fashiontrend', 'fashionweekend', 'fashionvibes', 'fashionmood', 'fashionable', 'fashionstylist', 'fashionlovers', 'fashiondaily',
      
      // Aesthetics (200+)
      'y2k', 'y2kfashion', 'y2kaesthetic', 'y2kstyle', 'y2kvibes', 'cottagecore', 'cottagecorestyle', 'cottagecoreoutfit', 'cottagecoreaesthetic',
      'darkacademia', 'darkacademiaaesthetic', 'darkacademiastyle', 'darkacademiaoutfit', 'darkacademiavibes',
      'lightacademia', 'lightacademiaaesthetic', 'lightacademiastyle', 'lightacademiaoutfit',
      'balletcore', 'balletcoreaesthetic', 'balletcorestyle', 'balletcoreoutfit', 'balletcoreinspo',
      'barbiecore', 'barbiecoreaesthetic', 'barbiestyle', 'barbieoutfit', 'barbiefashion', 'barbievibes',
      'gorpcore', 'gorpcoreaesthetic', 'gorpstyle', 'gorpcorestyle', 'outdoorcore',
      'cleangirlaesthetic', 'cleangirl', 'cleangirlstyle', 'cleangirloutfit', 'cleangirllook',
      'quietluxury', 'quietluxurystyle', 'quietluxuryfashion', 'quietluxuryaesthetic',
      'oldmoney', 'oldmoneyaesthetic', 'oldmoneystyle', 'oldmoneyoutfit', 'oldmoneyfashion', 'oldmoneyluxury',
      'coastalgrandmother', 'coastalgrandmotherstyle', 'coastalgran', 'coastalaesthetic', 'coastalstyle',
      'tomboy', 'tomboystyle', 'tomboyoutfit', 'tomboyaesthetic', 'tomboyfashion', 'tomboyvibes',
      'coquette', 'coquetteaesthetic', 'coquettestyle', 'coquetteoutfit', 'coquettefashion',
      'mobwife', 'mobwifeaesthetic', 'mobwifestyle', 'mobwifefashion', 'mobwifeoutfit',
      'vanilla girl', 'vanillagirlaesthetic', 'vanilla girlstyle', 'vanillagirloutfit',
      'cherrycore', 'cherryaesthetic', 'cherrystyle', 'cherryoutfit',
      'blokette', 'bloketteaesthetic', 'blokettestyle', 'bloketteoutfit',
      'office siren', 'officesiren', 'officesirenaesthetic', 'officesirenstyle',
      'mermaidcore', 'mermaidaesthetic', 'mermaidstyle', 'mermaidoutfit', 'mermaidvibes',
      'fairycore', 'fairycoreaesthetic', 'fairystyle', 'fairyoutfit', 'fairygrunge',
      'goblincore', 'goblincoreaesthetic', 'goblinstyle', 'goblinoutfit',
      'witchcore', 'witchcoreaesthetic', 'witchstyle', 'witchoutfit', 'witchfashion',
      'vampirecore', 'vampireaesthetic', 'vampirestyle', 'vampireoutfit', 'vampirefashion',
      'royalcore', 'royalcoreaesthetic', 'royalstyle', 'royaloutfit', 'royalfashion',
      'regencycore', 'regencyaesthetic', 'regencystyle', 'regencyoutfit', 'regencyera',
      'rococo', 'rococostyle', 'rococoaesthetic', 'rococofashion',
      'victorian', 'victorianstyle', 'victorianaesthetic', 'victorianoutfit', 'victorianfashion',
      'edwardian', 'edwardianstyle', 'edwardianaesthetic', 'edwardianoutfit',
      'artdeco', 'artdecostyle', 'artdecofashion', 'artdecoaesthetic',
      'retrofuturism', 'retrofuturismaesthetic', 'retrofuturisticstyle',
      'cyberpunk', 'cybercore', 'cyberpunkaesthetic', 'cyberstyle', 'cyberoutfit',
      'vaporwave', 'vaporwaveaesthetic', 'vaporwavestyle', 'vaporwavestylefashion',
      'synthwave', 'synthwaveaesthetic', 'synthwavestyle', 'synthwavefashion',
      'steampunk', 'steampunkaesthetic', 'steampunkstyle', 'steampunkoutfit', 'steampunkfashion',
      'dieselpunk', 'dieselpunkaesthetic', 'dieselpunkstyle',
      
      // Styles (150+)
      'streetwear', 'streetstyle', 'streetfashion', 'streetweardaily', 'streetwearoutfit', 'urbanstylle', 'urbanwear',
      'vintage', 'vintagefashion', 'vintagestyle', 'vintageoutfit', 'vintageclothing', 'vintagelook', 'vintagevibes', 'vintageshop',
      'retro', 'retrofashion', 'retrostyle', 'retrooutfit', 'retroclothing', 'retrovibes', 'retrolook',
      'boho', 'bohostyle', 'bohochic', 'bohemian', 'bohemianstyle', 'bohofashion', 'bohooutfit', 'bohemianchic', 'bohemianfashion',
      'minimalist', 'minimalistfashion', 'minimaliststyle', 'minimalistoutfit', 'minimalistwardrobe', 'minimalism',
      'maximalist', 'maximalistfashion', 'maximaliststyle', 'maximalistoutfit', 'maximalfashion',
      'grunge', 'grungestyle', 'grungefashion', 'grungeoutfit', 'grungeaesthetic', 'grungegirl', 'grungevibes',
      'preppy', 'preppystyle', 'preppyfashion', 'preppyoutfit', 'preppyaesthetic', 'preppylook', 'preppychic',
      'artsy', 'artsystyle', 'artsyfashion', 'artsyoutfit', 'artisticfashion', 'artfashion',
      'edgy', 'edgystyle', 'edgyfashion', 'edgyoutfit', 'edgylook', 'edgyaesthetic',
      'romantic', 'romanticstyle', 'romanticfashion', 'romanticoutfit', 'romanticlook', 'romanticaesthetic',
      'sporty', 'sportystyle', 'sportyfashion', 'sportyoutfit', 'sportylook', 'sportychic',
      'chic', 'chicstyle', 'chicfashion', 'chicoutfit', 'chiclook', 'parisianstyle',
      'elegant', 'elegantstyle', 'elegantfashion', 'elegantoutfit', 'elegantlook', 'elegance',
      'casual', 'casualstyle', 'casualfashion', 'casualoutfit', 'casualchic', 'casualwear',
      'formal', 'formalstyle', 'formalfashion', 'formaloutfit', 'formalwear', 'formallook',
      'alternative', 'alternativefashion', 'alternativestyle', 'alternativeoutfit', 'altstyle', 'altfashion',
      'punk', 'punkstyle', 'punkfashion', 'punkoutfit', 'punkaesthetic', 'punkrock', 'punkvibes',
      'emo', 'emostyle', 'emofashion', 'emooutfit', 'emoaesthetic', 'emogirl', 'emoboy',
      'scene', 'scenestyle', 'scenefashion', 'sceneoutfit', 'sceneaesthetic', 'scenekid',
      'kawaii', 'kawaiifashion', 'kawaiistyle', 'kawaiioutfit', 'kawaiiaesthetic', 'kawaiicore',
      'harajuku', 'harajukufashion', 'harajukustyle', 'harajukuoutfit', 'harajukugirl',
      
      // International Fashion (100+)
      'kfashion', 'koreanfashion', 'kstyle', 'koreanstyle', 'kbeauty', 'koreanlook', 'seoulstyle',
      'jfashion', 'japanesefashion', 'jstyle', 'tokyofashion', 'tokyostyle', 'japanstyle',
      'cfashion', 'chinesefashion', 'chinesestyle', 'chineselook', 'hanfu', 'qipao',
      'frenchstyle', 'frenchfashion', 'parisianstyle', 'frenchgirl', 'frenchgirlstyle', 'parisianvibes',
      'italianstyle', 'italianfashion', 'milanstyle', 'italiangirlstyle', 'dolcevita',
      'british', 'britishstyle', 'britishfashion', 'londonstyle', 'londonfashion', 'britishchic',
      'scandinavian', 'scandinavianstyle', 'scandinavianfashion', 'nordicstyle', 'nordicfashion',
      'american', 'americanstyle', 'americanfashion', 'americancasual', 'usastyle',
      'african', 'africanfashion', 'africanstyle', 'africanprint', 'ankara', 'dashiki',
      'indian', 'indianfashion', 'indianstyle', 'saree', 'lehenga', 'kurti', 'salwar',
      'arabic', 'arabicfashion', 'arabicstyle', 'middleasternfashion', 'modest', 'modestwear', 'modestfashion',
      'latin', 'latinfashion', 'latinstyle', 'latinamerican', 'caribbean', 'caribbeanstyle',
      
      // Specific items (200+)
      'denim', 'jeans', 'denimjacket', 'denimstyle', 'denimoutfit', 'doubledenim', 'denimondenim',
      'leather', 'leatherjacket', 'leatherpants', 'leatherskirt', 'leatheroutfit', 'leatherlook',
      'oversized', 'oversizedstyle', 'oversizedoutfit', 'oversizedhoodie', 'oversizedjacket', 'oversizedsweater',
      'croptop', 'croptops', 'croppedtop', 'croppedsweater',
      'widelegpants', 'widelegtrousers', 'widelegjeans', 'flaredpants',
      'cargopants', 'cargo', 'cargostyle', 'cargotrousers', 'cargojeans',
      'blazer', 'blazerstyle', 'oversizedblazer', 'blazeroutfit', 'doublebreasted', 'singlebreasted',
      'trenchcoat', 'trench', 'trenchcoatstyle', 'trenchoutfit',
      'puffjacket', 'puffer', 'pufferjacket', 'downcoat', 'quiltedjacket',
      'cardigan', 'cardiganstyle', 'cardiganoutfit', 'longcardigan', 'cropped cardigan',
      'tshirt', 'tshirtstyle', 'tshirtoutfit', 'graphictee', 'slogan tee', 'bandtee',
      'hoodie', 'hoodieoutfit', 'hoodiestyle', 'hoodieszn', 'zipuphoodie', 'pulloverehoodie',
      'sweater', 'sweaterstyle', 'sweateroutfit', 'knitwear', 'knitsweater', 'chunkyknit',
      'blouse', 'blousestyle', 'silkblouse', 'satinblouse', 'ruffledblouse',
      'tank', 'tanktop', 'tankstyle', 'ribbed tank', 'croppedtank',
      'bodysuit', 'bodysuits', 'bodysuitstyle', 'bodysuitoutfit',
      'jumpsuit', 'jumpsuits', 'jumpsuistyle', 'romper', 'playsuit',
      'dress', 'dresses', 'dressoutfit', 'dressstyle', 'dresslook',
      'maxidress', 'maxidresses', 'longdress', 'floorlength',
      'minidress', 'minidresses', 'shortdress', 'miniskirtdress',
      'midilength', 'mididress', 'mididresses', 'tealelengtgh',
      'slipdress', 'slipdresses', 'silkdress', 'satindress',
      'weddingdress', 'bridesmaiddress', 'eveningdress', 'cocktaildress', 'balldress',
      'sundress', 'summerdress', 'floraldress', 'maxis undress',
      'shirt', 'shirtdress', 'buttonup', 'buttondown', 'dresshirt', 'overshirt',
      'skirt', 'skirts', 'skirtstyle', 'skirtoutfit',
      'miniskirt', 'miniskirts', 'shortskirt', 'microskirt',
      'midiskirt', 'midiskirts', 'mediumskirt', 'kneelength',
      'maxiskirt', 'maxiskirts', 'longskirt', 'floorлength skirt',
      'pleatedskirt', 'pleated', 'pleatsstyle',
      'denimskirt', 'jeanskirt', 'denimminiskirt',
      'leatherskirt', 'pleathermini', 'leathermaxi',
      'tenniskirt', 'skort', 'sportskirt', 'athleticskirt',
      'shorts', 'shortsstyle', 'shortsoutfit', 'summerzhorts',
      'denimshorts', 'jeanshorts', 'cutoffs', 'distressedshorts',
      'cargoshorts', 'utilityshlorts',
      'bikershorts', 'cycleshorts', 'spandexshorts',
      'leggings', 'leggingsstyle', 'leggingslook', 'leggingsoutfit',
      'yogapants', 'athleticleggings', 'gymleggings',
      'leather leggings', 'fauxleather', 'latexleggings',
      'trousers', 'pants', 'slacks', 'trousersstyle',
      'dresszpants', 'formaltrousers', 'tailoredpants',
      'chinos', 'chinostyle', 'chinotrousers',
      'joggers', 'jogggerstyle', 'sweatpants', 'trackpants',
      
      // Footwear (100+)
      'sneakers', 'sneakerhead', 'sneakerstyle', 'sneakerculture', 'sneakerfashion', 'kickks', 'trainers',
      'boots', 'bootstyle', 'bootseason', 'bootsoutfit', 'bootlove', 'bootfashion',
      'ankleboots', 'chelseaboots', 'combatboots', 'cowboyboots', 'westernboots', 'hikingboots',
      'kneehighboots', 'overthekneeboots', 'thighhighboots', 'ridingboots',
      'heels', 'highheels', 'heelsstyle', 'heelsoutfit', 'heellove', 'stilettos',
      'platformshoes', 'platform', 'platformheels', 'platformsneakers', 'platformboots', 'chunkyplatform',
      'loafers', 'loaferstyle', 'loaferoutfit', 'pennyloafers', 'tasselloafers',
      'sandals', 'sandalsstyle', 'sandalsoutfit', 'summersandals', 'gladiatorsandals',
      'flipflops', 'slides', 'sliders', 'poolslides', 'sportslides',
      'slippers', 'slipperstyle', 'houseslippers', 'furryslippers',
      'flats', 'balletflats', 'pointedflats', 'loaferflats',
      'mules', 'mulestyle', 'backleszs', 'slideמmules',
      'espadrilles', 'espadrillesstyle', 'espadrillewedges',
      'wedges', 'wedgeheels', 'wedgesandals', 'wedgebooties',
      'maryjanes', 'maryjanesstyle', 'maryjaneheels', 'maryjanef flats',
      
      // Accessories (150+)
      'accessories', 'accessorize', 'accessorystyle', 'accessorylove',
      'jewelry', 'jewellery', 'jewelrystyle', 'jewelryfashion', 'jewelryinspo', 'jewels',
      'necklaces', 'necklace', 'necklacestyle', 'layerednecklaces', 'statementnecklace', 'choker', 'pendant',
      'earrings', 'earringstyle', 'hoopearrings', 'studearrings', 'dropearrings', 'statementearrings',
      'rings', 'ringstyle', 'stackingrings', 'statementring', 'engagementring', 'cocktailring',
      'bracelets', 'braceletstyle', 'bangles', 'cuff', 'tennis bracelet', 'charmbracelet',
      'watches', 'watchstyle', 'luxurywatch', 'smartwatch', 'vintagelwatch', 'dresslwatch',
      'sunglasses', 'sunnies', 'sunglassesstyle', 'shades', 'aviators', 'wayfarers', 'cateye',
      'eyeglasses', 'glasses', 'frames', 'eyewear', 'spectacles',
      'bags', 'handbags', 'bagstyle', 'pursestyle', 'designerbag', 'luxurybag',
      'shoulderbag', 'crossbodybag', 'totebag', 'clutch', 'eveningbag',
      'backpack', 'backpackstyle', 'minizbackpack', 'leatherbackpack',
      'beltbag', 'fannybag', 'bumbag', 'waistbag',
      'belts', 'beltstyle', 'leatherbelt', 'chainbelt', 'widebelt', 'statementbelt',
      'scarves', 'scarf', 'scarfstyle', 'silkscarf', 'winterscarf', 'headsscarf',
      'hats', 'hatstyle', 'hatoutfit', 'hatfashion',
      'beanie', 'beanieseason', 'winterhat', 'knittedhat',
      'baseballcap', 'cap', 'capstyle', 'trucker hat', 'snapback',
      'bucket hat', 'buckethatstyle', 'summerhat',
      'fedora', 'fledorastyle', 'felt hat', 'widebrizmhat',
      'beret', 'beretstyle', 'frenchberet', 'wool beret',
      'sunhat', 'strawhat', 'beachhat', 'flopрyhat',
      'gloves', 'glovesstyle', 'leathergloves', 'wintergloves',
      'tights', 'hosiery', 'stocкings', 'fishnetstights', 'sheertights',
      'socks', 'sockstyle', 'anklesocks', 'knessocks', 'fuzzy socks',
      
      // Occasions (100+)
      'workwear', 'workoutfit', 'officestyle', 'businesscasual', 'officefashion', 'workfashion', 'corporatestyle',
      'datenight', 'datenightoutfit', 'datenightstyle', 'datenightlook', 'romanticoutfit',
      'brunch', 'brunchoutfit', 'brunchstyle', 'brunchlook', 'weekendbrunch',
      'party', 'partyoutfit', 'partystyle', 'partydress', 'partylook', 'partyseason',
      'vacation', 'vacationstyle', 'vacationoutfit', 'vacationlook', 'travelfashion', 'travelstyle',
      'wedding', 'weddingguestdress', 'weddingoutfit', 'weddingstyle', 'weddinglook', 'weddingseason',
      'gymwear', 'gymoutfit', 'gymstyle', 'workoutclothes', 'activewear', 'fitnessfashion', 'athleisure',
      'festivalfashion', 'festivaloutfit', 'festivalstyle', 'coachella', 'musicfestival',
      'holidayoutfit', 'holidaystyle', 'holidayfashion', 'christmas outfit', 'newyearseve',
      'beachwear', 'beachoutfit', 'beachstyle', 'swimwear', 'bikini', 'swimsuit', 'coverup',
      'loungewear', 'lounge', 'loungeoutfit', 'comfywear', 'athome', 'relaxed',
      'sleepwear', 'pajamas', 'nightwear', 'pjs', 'silk pajamas', 'matching set',
      
      // Seasons (80+)
      'springfashion', 'springstyle', 'springoutfit', 'springvibes', 'springtrends', 'springlook',
      'summerfashion', 'summerstyle', 'summeroutfit', 'summervibes', 'summertrends', 'summerlook',
      'fallfashion', 'fallstyle', 'falloutfit', 'fallvibes', 'autumnfashion', 'autumnstyle', 'sweaterweather',
      'winterfashion', 'winterstyle', 'winteroutfit', 'wintervibes', 'wintertrends', 'winterlook', 'cozyseason',
      
      // Colors & patterns (200+)
      'allblack', 'blackoutfit', 'blackstyle', 'monochrome black', 'gothic black',
      'allwhite', 'whiteoutfit', 'whitestyle', 'summтerwhite', 'winterwhite',
      'neutrals', 'neutralstyle', 'neutraloutfit', 'beige', 'taupe', 'cream', 'ivory',
      'earth tones', 'earthycolors', 'brown', 'terracotta', 'rust', 'ochre',
      'pastels', 'pastelstyle', 'pasteloutfit', 'pastelcolors', 'softcolors',
      'neon', 'neonstyle', 'neonoutfit', 'brightcolors', 'fluoresceлnt',
      'red', 'redoutfit', 'redstyle', 'redgdress', 'valentinered',
      'pink', 'pinkoutfit', 'pinkstyle', 'hotpink', 'babypink', 'millesnialpink',
      'blue', 'blueoutfit', 'bluestyle', 'navyblue', 'babyblue', 'cobaltblue',
      'green', 'greenoutfit', 'greenstyle', 'emeraldgreen', 'sage', 'olivegreen',
      'yellow', 'yellowoutfit', 'yellowstyle', 'sunfloweryellow', 'mustardyellow',
      'orange', 'orangeoutfit', 'orangestyle', 'burjntorange', 'coralorange',
      'purple', 'purpleoutfit', 'purplestyle', 'lavender', 'lilac', 'violet',
      'metallic', 'metallicstyle', 'silver', 'gold', 'bronze', 'shimmer', 'glitter',
      'animalprint', 'leopardprint', 'zebraprint', 'snakeskin', 'cheetahprint', 'tigerprint',
      'florals', 'floralprint', 'floralstyle', 'flowerdress', 'botanicalprint',
      'stripes', 'stripedstyle', 'horizontalstripes', 'verticalstripes', 'navalstripes',
      'polkadots', 'dotted', 'spotty',
      'plaid', 'check', 'gingham', 'tartan', 'buffalo check',
      'tie dye', 'tiedye', 'tiedyestyle',
      'colorblock', 'colorblocking', 'colorblockedoutfit',
      'ombre', 'gradient', 'dipldye',
      'textures', 'textured', 'mixedtextures',
      
      // Brands & luxury (80+)
      'luxury', 'luxuryfashion', 'luxurystyle', 'luxuryoutfit', 'luxurybrands', 'designerfashion',
      'designer', 'designerstyle', 'designeroutfit', 'designerbag', 'designershoes',
      'highfashion', 'hautecouture', 'runway', 'catjwalk', 'fashionshow',
      'streetstyle', 'streetfashion', 'urbanstyle',
      'thrift', 'thrifted', 'thriftstyle', 'thriftoutfit', 'thriftfinds', 'secondhand', 'vintagethrift',
      'sustainable', 'sustainablefashion', 'ecofashion', 'ethical', 'slowfashion', 'conscious',
      'upcycled', 'upcycling', 'reworked', 'customized', 'diy fashion',
      
      // Body types (50+)
      'petite', 'petitestyle', 'petitefashion', 'petiteoutfit', 'shortstyle', 'shortiestyle',
      'tall', 'tallstyle', 'tallfashion', 'tallgirlстиль', 'tallgirloutfit',
      'curvy', 'curvystyle', 'curvyfashion', 'curvyoutfit', 'curves',
      'plus', 'plussize', 'plussizestyle', 'plussizefashion', 'plussizeoutfit',
      'midsize', 'midsizestyle', 'midsizefashion', 'midsizeoutfit',
      'athletic', 'athleticbuild', 'fitestyle',
      
      // Trends (100+)
      'microtrend', 'trending', 'viral', 'fyp', 'foryou', 'explore', 'tiktokfashion', 'instafashion', 'pinterestfashion',
      'dopamine', 'dopaminedressing', 'dopaminestyle', 'happycolors',
      'normcore', 'normcorestyleз', 'basicstyle',
      'athleisure', 'athleisurestyle', 'sportychic', 'activewear style',
      'businesscasual', 'smartcasual', 'dresseddown',
      'layering', 'layeredstyle', 'layeredoutfit', 'layers',
      'monochrome', 'monochromestyle', 'monochromeoutfit', 'tonal dressing',
      'mixedprints', 'patternmixing', 'printclashing',
      'statement', 'statementpiece', 'statementstyle', 'boldchoice',
      'capsulewardrobe', 'capsule', 'essentials', 'basics', 'staples', 'timeless',
      'slowfashion', 'mindful', 'intentional', 'quality over quantity',
      'genderneutral', 'unisex', 'androgynous', 'gender fluid',
      'matchingset', 'coordinated', 'twopiece', 'coộrd',
      'sheer', '透transparent', 'seethrough', 'mesh', 'organza',
      'cutouts', 'slashed', 'asymmetric', 'deconstructed',
      'corset', 'corsetdress', 'corsetop', 'bustier',
      'puffssleeves', 'volumesleeves', 'statementsleeveдs', 'bishopsleeves',
      'pearls', 'pearlstyle', 'pearlnecklace', 'pearlsandall',
      'ribbons', 'bows', 'bowdetail', 'ribbon trim',
    ];
    const allResults: any[] = [];
    
    // TikTok API headers to mimic browser requests
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'application/json',
    };
    
    for (const hashtag of fashionHashtags) {
      try {
        // Use TikTok's unofficial API endpoint for hashtag search
        const url = `https://www.tiktok.com/api/challenge/detail/?challengeName=${hashtag}`;
        console.log(`Fetching TikTok data for hashtag: ${hashtag}`);
        
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.challengeInfo) {
            const viewCount = data.challengeInfo.stats?.viewCount || 0;
            const videoCount = data.challengeInfo.stats?.videoCount || 0;
            
            allResults.push({
              hashtag: `#${hashtag}`,
              description: data.challengeInfo.desc || `Trending fashion style featuring ${hashtag}`,
              viewCount: viewCount,
              videoCount: videoCount,
              tags: [hashtag.toLowerCase(), 'fashion', 'tiktok'],
            });
            
            console.log(`Successfully fetched ${hashtag}: ${viewCount} views`);
          }
        } else {
          console.log(`Failed to fetch ${hashtag}: ${response.status}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error fetching hashtag ${hashtag}:`, error);
      }
    }
    
    console.log(`Retrieved ${allResults.length} hashtags from TikTok`);
    return allResults;
    
  } catch (error) {
    console.error('TikTok scraping error:', error);
    throw error;
  }
}

async function fetchGoogleTrends(keywords: string[]): Promise<Map<string, number>> {
  const trendsMap = new Map<string, number>();
  
  try {
    // Google Trends doesn't have a free official API, so we'll use search interest as proxy
    // We'll make requests to Google Trends explore endpoint
    for (const keyword of keywords) {
      try {
        const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=-480&geo=US`;
        const response = await fetch(url);
        
        if (response.ok) {
          const text = await response.text();
          // Remove the leading characters that make it not valid JSON
          const jsonStr = text.substring(text.indexOf('{'));
          const data = JSON.parse(jsonStr);
          
          // Extract trend score based on search volume
          // This is a simplified approach - real implementation would need more sophisticated parsing
          const score = Math.floor(Math.random() * 100); // Placeholder for now
          trendsMap.set(keyword, score);
        }
      } catch (error) {
        console.error(`Error fetching Google Trends for ${keyword}:`, error);
        trendsMap.set(keyword, 0);
      }
    }
  } catch (error) {
    console.error('Error in fetchGoogleTrends:', error);
  }
  
  return trendsMap;
}

function getTrendDescription(hashtag: string, originalDesc: string): string {
  const tag = hashtag.replace('#', '').toLowerCase();
  
  const descriptions: { [key: string]: string } = {
    // Core aesthetics (100+)
    'y2k': 'Early 2000s fashion revival featuring low-rise jeans, baby tees, rhinestones, velour tracksuits, and butterfly accessories. Think Paris Hilton and Britney Spears era.',
    'y2kfashion': 'Nostalgic millennium style with metallic fabrics, platform flip-flops, cargo pants, and bold accessories from the iconic 2000s era.',
    'y2kaesthetic': 'Digital-age nostalgia combining tech aesthetics, bubblegum pop culture, and playful early internet vibes in fashion.',
    'cottagecore': 'Romantic countryside aesthetic with flowy dresses, floral patterns, lace details, puffed sleeves, and nature-inspired accessories.',
    'cottagecorestyle': 'Whimsical pastoral fashion featuring vintage linens, embroidered details, straw hats, and soft, dreamy silhouettes.',
    'darkacademia': 'Scholarly aesthetic with tweed blazers, turtlenecks, leather oxford shoes, and vintage-inspired pieces inspired by classic literature.',
    'darkacademiastyle': 'Intellectual fashion featuring rich browns, plaids, leather-bound accessories, and moody academic vibes.',
    'darkacademiaoutfit': 'Preppy yet mysterious ensembles with tailored coats, knit vests, oxford shoes, and literary-inspired accessories.',
    'lightacademia': 'Softer academic style with cream and beige tones, linen fabrics, and romantic scholarly vibes with optimistic energy.',
    'lightacademiaaesthetic': 'Bright intellectual fashion featuring white blouses, light cardigans, golden hour aesthetics, and poetic elegance.',
    'balletcore': 'Ballet-inspired fashion featuring wrap cardigans, leg warmers, soft pink tones, delicate ribbons, and graceful silhouettes.',
    'balletcoreaesthetic': 'Dance-inspired elegance with satin ribbons, tulle skirts, ballet flats, and ethereal feminine details.',
    'barbiecore': 'All-pink maximalist aesthetic with hot pink outfits, feminine silhouettes, playful accessories, and bold confident styling.',
    'barbiestyle': 'Hyper-feminine fashion celebrating pink power, glamorous details, nostalgic toy aesthetics, and unapologetic femininity.',
    'gorpcore': 'Outdoor gear meets street style with technical fabrics, hiking boots, utility vests, cargo pants, and functional fashion.',
    'gorpcoreaesthetic': 'Adventure-ready urban style combining performance wear, earthy tones, practical layering, and outdoor functionality.',
    'cleangirlaesthetic': 'Minimal polished look with slicked-back bun, dewy makeup, gold hoop earrings, neutral tones, and effortless chic.',
    'cleangirl': 'Fresh minimalist style focusing on groomed appearance, simple elegance, natural beauty, and refined basics.',
    'quietluxury': 'Understated wealth aesthetic featuring high-quality basics, neutral colors, perfect tailoring, minimal branding, and timeless craftsmanship.',
    'quietluxurystyle': 'Sophisticated elegance emphasizing fabric quality, impeccable fit, subtle details, and refined taste over logos.',
    'oldmoney': 'Timeless preppy style with polo shirts, tennis skirts, loafers, and classic pieces suggesting generational wealth.',
    'oldmoneyaesthetic': 'Inherited elegance featuring heritage brands, nautical themes, country club fashion, and aristocratic refinement.',
    'oldmoneystyle': 'Generational wealth wardrobe with cashmere, pearls, boat shoes, and effortlessly expensive-looking basics.',
    'coastalgrandmother': 'Relaxed sophisticated style inspired by beach house living with linen fabrics, wide-leg pants, neutral tones, and straw hats.',
    'coastalgran': 'Effortlessly elegant seaside fashion featuring breezy layers, natural fibers, sun-faded colors, and timeless coastal pieces.',
    'tomboy': 'Gender-neutral casual style with baggy jeans, oversized tees, sneakers, and comfortable androgynous fashion.',
    'tomboystyle': 'Athletic comfortable fashion mixing masculine cuts, sporty elements, relaxed fits, and practical streetwear.',
    'coquette': 'Ultra-feminine romantic style with bows, lace, ribbons, soft pastels, and flirtatious vintage-inspired details.',
    'coquetteaesthetic': 'Sweet delicate fashion featuring baby doll dresses, heart motifs, pearl accessories, and innocent romanticism.',
    'mobwife': 'Glamorous luxurious style with fur coats, gold jewelry, leopard print, oversized sunglasses, and Italian luxury vibes.',
    'mobwifeaesthetic': 'Opulent fashion inspired by 90s mafia movies featuring designer logos, silk scarves, bold accessories, and confident glamour.',
    'vanillagirl': 'Soft minimalist aesthetic with cream colors, cozy knits, simple accessories, and understated comfortable elegance.',
    'vanillagirlstyle': 'Neutral-toned simplicity featuring beige palettes, soft textures, minimal jewelry, and effortless everyday chic.',
    'officesiren': 'Seductive professional style mixing business attire with sultry elements like sheer blouses, pencil skirts, and sophisticated glamour.',
    'officesirenaesthetic': 'Corporate femme fatale fashion featuring power suits, stilettos, red lips, and confident sensual professionalism.',
    'mermaidcore': 'Ocean-inspired aesthetic with iridescent fabrics, sea-foam colors, shell accessories, and aquatic ethereal beauty.',
    'mermaidaesthetic': 'Underwater fantasy fashion featuring scales, pearls, flowing fabrics, blue-green tones, and mythical sea creature glamour.',
    'fairycore': 'Whimsical forest aesthetic with earth tones, flowing fabrics, floral crowns, mushroom prints, and magical woodland vibes.',
    'fairygrunge': 'Dark fairy fashion mixing grunge elements with fantasy aesthetics, featuring torn wings, combat boots, and mystical rebellion.',
    'goblincore': 'Nature-loving aesthetic embracing earth tones, mushrooms, moss, frogs, and celebrating the beauty in unconventional natural elements.',
    'witchcore': 'Mystical occult style with dark flowing garments, moon symbols, crystal jewelry, velvet textures, and magical aesthetics.',
    'witchstyle': 'Spiritual fashion featuring pentagrams, tarot imagery, black lace, wide-brim hats, and enchanting mysterious vibes.',
    'vampirecore': 'Gothic romantic style with dark reds, blacks, Victorian elements, dramatic capes, and immortal elegance.',
    'vampireaesthetic': 'Immortal fashion featuring corsets, velvet, dramatic collars, blood-red accents, and eternal night aesthetics.',
    'royalcore': 'Regal aesthetic inspired by monarchies with luxurious fabrics, crowns, jewel tones, ornate details, and aristocratic elegance.',
    'regencycore': 'Jane Austen era fashion featuring empire waists, delicate muslins, bonnets, gloves, and Regency romance elegance.',
    'victorian': 'Victorian era style with high collars, long skirts, corsets, lace, and intricate historical fashion details.',
    'edwardian': 'Edwardian period fashion featuring S-bend corsets, leg-of-mutton sleeves, elaborate hats, and Belle Époque elegance.',
    'artdeco': '1920s-1930s aesthetic with geometric patterns, metallic embellishments, drop-waist dresses, and Jazz Age glamour.',
    'cyberpunk': 'Futuristic dystopian style with neon accents, tech wear, holographic materials, LED accessories, and sci-fi urban edge.',
    'cybercore': 'Digital age fashion featuring reflective materials, geometric cuts, technological aesthetics, and matrix-inspired elements.',
    'vaporwave': 'Retro-futuristic aesthetic with pastel pink-purple gradients, 80s-90s nostalgia, glitch art, and dreamy surreal vibes.',
    'synthwave': '1980s-inspired neon aesthetic with electric colors, geometric shapes, retro-futuristic elements, and Miami Vice vibes.',
    'steampunk': 'Victorian sci-fi aesthetic with brass goggles, corsets, gears, leather, and industrial revolution fantasy elements.',
    
    // Style categories (100+)
    'streetwear': 'Urban fashion featuring oversized hoodies, sneakers, graphic tees, and influences from hip-hop and skateboarding culture.',
    'streetstyle': 'Real-world fashion captured in cities worldwide, mixing high and low fashion with individual creative expression.',
    'vintage': 'Retro fashion from past decades featuring thrifted pieces, nostalgic silhouettes, and timeless classic styling.',
    'vintagestyle': 'Authentic period fashion celebrating decades past with genuine vintage garments and nostalgic aesthetics.',
    'retro': 'Vintage-inspired modern fashion referencing past eras with contemporary updates and nostalgic styling.',
    'boho': 'Bohemian free-spirited style with flowing fabrics, earth tones, fringe details, layered jewelry, and eclectic accessories.',
    'bohochic': 'Elevated bohemian aesthetic mixing artistic freedom with refined sophistication and worldly elegance.',
    'minimalist': 'Less-is-more approach with clean lines, neutral colors, simple silhouettes, quality basics, and curated wardrobes.',
    'minimalistfashion': 'Pared-down style philosophy emphasizing quality over quantity, timeless pieces, and intentional wardrobe curation.',
    'maximalist': 'More-is-more aesthetic with bold patterns, vibrant colors, excessive layering, and fearless expressive styling.',
    'grunge': '90s rebellious style with flannel shirts, ripped jeans, combat boots, band tees, and deliberately disheveled aesthetics.',
    'grungeaesthetic': 'Alternative rock-inspired fashion embracing imperfection, distressed fabrics, dark colors, and anti-fashion attitude.',
    'preppy': 'Classic collegiate style with polo shirts, cardigans, pleated skirts, loafers, and clean-cut polished preppy looks.',
    'preppystyle': 'Ivy League fashion featuring crisp whites, navy blazers, cable knits, pearls, and traditional American sportswear.',
    'edgy': 'Bold alternative fashion with leather, studs, dark colors, asymmetric cuts, and rebellious confident styling.',
    'edgystyle': 'Daring fashion pushing boundaries with unconventional silhouettes, unexpected combinations, and fearless attitude.',
    'romantic': 'Feminine dreamy style with soft fabrics, floral details, ruffles, lace, and delicate romantic aesthetics.',
    'romanticstyle': 'Love-inspired fashion featuring flowing silhouettes, vintage romance, soft colors, and ethereal femininity.',
    'sporty': 'Athletic-inspired casual wear mixing performance fabrics, sneakers, track pants, and comfortable activewear elements.',
    'sportychic': 'Elevated athleisure combining athletic pieces with fashion-forward styling and street-smart sophistication.',
    'chic': 'Effortlessly stylish fashion with polished pieces, flattering fits, sophisticated details, and French-inspired elegance.',
    'parisianstyle': 'French fashion philosophy emphasizing quality basics, effortless elegance, neutral tones, and understated sophistication.',
    'elegant': 'Refined graceful fashion with classic silhouettes, luxurious fabrics, timeless pieces, and sophisticated styling.',
    'casual': 'Everyday comfortable fashion with jeans, tees, sneakers, and relaxed approachable styling.',
    'casualchic': 'Elevated everyday wear mixing comfort with style, featuring upgraded basics and effortless polish.',
    'punk': 'Rebellious anti-establishment style with leather jackets, safety pins, plaid, mohawks, and DIY aesthetic.',
    'punkrock': 'Music-inspired rebellion fashion with band tees, studded accessories, ripped fishnets, and anarchist attitude.',
    'emo': 'Emotional alternative style with black clothing, band merchandise, skinny jeans, side-swept bangs, and expressive darkness.',
    'emostyle': 'Music subculture fashion featuring scene aesthetics, emotional expression, dark romanticism, and alternative identity.',
    'goth': 'Dark dramatic aesthetic with all-black outfits, leather, lace, heavy boots, silver jewelry, and gothic-inspired accessories.',
    'gothic': 'Victorian-inspired dark fashion with religious imagery, romantic elements, dramatic makeup, and mysterious elegance.',
    'kawaii': 'Japanese cute culture featuring pastel colors, playful prints, oversized bows, character motifs, and adorable fashion.',
    'kawaiifashion': 'J-fashion cuteness aesthetic with sweet details, childlike innocence, bright colors, and charming accessories.',
    'harajuku': 'Tokyo street fashion hub celebrating eclectic mixing, bold colors, subculture styles, and fearless self-expression.',
    'harajukustyle': 'Japanese avant-garde fashion featuring extreme creativity, pattern mixing, layering, and boundary-pushing aesthetics.',
    
    // International (50+)
    'kfashion': 'Korean fashion featuring trendy silhouettes, cute aesthetics, layered styling, and Seoul street style influences.',
    'koreanfashion': 'K-style combining oversized fits, pastel colors, mix-and-match coordination, and youthful Korean trends.',
    'jfashion': 'Japanese fashion encompassing diverse subcultures from Harajuku street style to minimalist Tokyo elegance.',
    'frenchstyle': 'Parisian chic philosophy emphasizing quality basics, effortless elegance, neutral palettes, and timeless sophistication.',
    'frenchgirl': 'French fashion attitude featuring undone hair, red lips, striped shirts, and nonchalant Parisian cool.',
    'italianstyle': 'Italian fashion emphasizing tailoring, luxury fabrics, bold accessories, and confident Mediterranean glamour.',
    'britishstyle': 'British fashion mixing punk heritage, tailored tradition, quirky prints, and London street style edge.',
    'scandinavian': 'Nordic minimalism featuring clean lines, neutral colors, functional design, and understated Scandinavian elegance.',
    'scandinavianstyle': 'Hygge-inspired fashion with cozy knits, sustainable materials, simple silhouettes, and effortless Nordic cool.',
    
    // Clothing items (50+)
    'denim': 'Classic durable fabric fashion featuring jeans, jackets, skirts, and versatile blue jean culture.',
    'denimstyle': 'Jean-focused outfits from double denim to distressed styles celebrating this timeless fabric.',
    'leather': 'Edgy luxurious material featuring jackets, pants, skirts, and rock-and-roll attitude.',
    'leatherjacket': 'Iconic outerwear staple embodying rebellion, coolness, and timeless bad-ass style.',
    'oversized': 'Deliberately large silhouettes featuring baggy fits, comfort-first fashion, and relaxed modern proportions.',
    'oversizedstyle': 'Anti-fitted fashion embracing volume, comfort, and contemporary streetwear proportions.',
    'blazer': 'Structured jacket essential for professional polish, power dressing, and elevated sophistication.',
    'blazerstyle': 'Tailored jacket styling from office-appropriate to oversized streetwear interpretations.',
    'trenchcoat': 'Classic waterproof coat staple offering timeless elegance, British heritage, and versatile layering.',
    'cardigan': 'Cozy knit layering piece from preppy classics to oversized contemporary styles.',
    'hoodie': 'Casual comfort staple embodying streetwear culture, athleisure, and relaxed modern dressing.',
    'croptop': 'Midriff-baring top from athletic styles to going-out fashion celebrating body confidence.',
    'widelegpants': 'Flowy relaxed trousers offering comfort, elegance, and 70s-inspired sophisticated silhouettes.',
    'cargopants': 'Utilitarian pants with multiple pockets embodying Y2K nostalgia and functional streetwear.',
    
    // Colors & patterns (50+)
    'allblack': 'Monochromatic dark styling from gothic elegance to minimalist chic and urban sophistication.',
    'blackoutfit': 'Head-to-toe dark ensembles offering slimming effects, versatility, and timeless elegance.',
    'neutrals': 'Earth-toned palette featuring beiges, browns, creams, and sophisticated understated elegance.',
    'pastels': 'Soft color palette with baby pinks, powder blues, mint greens, and gentle romantic aesthetics.',
    'neon': 'Bright fluorescent colors from 80s revival to athletic wear and bold statement fashion.',
    'animalprint': 'Leopard, zebra, snake patterns offering wild sophistication and bold animalistic glamour.',
    'leopardprint': 'Classic feline pattern from vintage glamour to modern street style sophistication.',
    'florals': 'Flower patterns from romantic cottagecore to bold tropical prints and feminine garden aesthetics.',
    'floralprint': 'Botanical designs offering feminine romance, vintage charm, and nature-inspired beauty.',
    'stripes': 'Linear patterns from nautical Breton stripes to bold horizontal and vertical graphic designs.',
    'polkadots': 'Playful circular patterns offering vintage charm, retro aesthetics, and whimsical styling.',
    'plaid': 'Checked patterns from preppy tartans to grunge flannel and British heritage textiles.',
    'metallics': 'Shiny reflective fabrics in silver, gold, bronze offering futuristic glamour and party-ready shine.',
    
    // Occasions (30+)
    'workwear': 'Professional office fashion from business formal to smart casual workplace appropriate styling.',
    'datenight': 'Romantic going-out fashion featuring flattering silhouettes, special details, and confidence-boosting style.',
    'brunch': 'Weekend social fashion mixing casual comfort with presentable polish and daytime elegance.',
    'party': 'Celebratory fashion featuring sparkles, bold colors, statement pieces, and festive confidence.',
    'vacation': 'Travel-ready resort wear featuring breezy fabrics, versatile pieces, and effortless holiday style.',
    'wedding': 'Guest-appropriate formal fashion celebrating romance while respecting ceremony dress codes.',
    'gymwear': 'Athletic performance fashion mixing function with style in activewear and fitness fashion.',
    'athleisure': 'Athletic-leisure hybrid combining workout clothes with everyday styling and comfortable chic.',
    'beachwear': 'Coastal vacation fashion with swimwear, cover-ups, sandals, and sun-ready resort style.',
    
    // Footwear (20+)
    'sneakers': 'Athletic footwear culture from performance shoes to fashion sneakers and streetwear essentials.',
    'sneakerhead': 'Sneaker collecting culture celebrating limited releases, collaborations, and shoe obsession.',
    'boots': 'Versatile footwear from ankle boots to knee-highs offering style and practical coverage.',
    'combatboots': 'Military-inspired lace-up boots embodying grunge, punk, and rebellious attitude.',
    'heels': 'Elevated footwear from stilettos to block heels offering height, elegance, and feminine power.',
    'platformshoes': 'Thick-soled footwear offering height, 70s nostalgia, and bold statement styling.',
    'loafers': 'Slip-on shoes from preppy classics to contemporary minimalist and androgynous styling.',
  };
  
  return descriptions[tag] || originalDesc || `Trending fashion style featuring ${hashtag}. Popular on TikTok with millions of views and creative outfit interpretations.`;
}

function extractTrendsFromTikTokData(tiktokData: any[]): any[] {
  // First, sort by view count to get relative popularity
  const sortedData = [...tiktokData].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  
  return sortedData
    .map((item: any, index: any) => {
      const views = item.viewCount || 0;
      
      // Calculate popularity score based on relative ranking and absolute metrics
      // Top trend gets 100, scores decrease proportionally
      const rankScore = Math.round(100 - (index * (100 / sortedData.length)));
      
      // Bonus points for extremely high engagement (billions of views)
      let engagementBonus = 0;
      if (views > 500000000000) engagementBonus = 10; // 500B+ views
      else if (views > 100000000000) engagementBonus = 5; // 100B+ views
      
      const popularityScore = Math.min(rankScore + engagementBonus, 100);
      
      const trendName = item.hashtag.replace('#', '').replace(/([A-Z])/g, ' $1').trim();
      
      return {
        name: trendName,
        description: getTrendDescription(item.hashtag, item.description),
        tags: item.tags || [item.hashtag.toLowerCase()],
        source: 'TikTok',
        popularity_score: popularityScore,
      };
    })
    .slice(0, 15); // Top 15 trends
}

async function enhanceTrendsWithAI(trends: any[]): Promise<TrendWithHistory[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY found, using basic descriptions');
    return trends.map(trend => ({
      ...trend,
      source: 'TikTok Fashion Data'
    }));
  }

  console.log('Enhancing trends with AI fashion analysis...');
  
  const enhancedTrends = [];
  
  for (const trend of trends) {
    try {
      const prompt = `Analyze this fashion trend: "${trend.name}"

Current basic description: ${trend.description}

Provide a detailed, fashion-expert analysis covering:
1. Key clothing items and pieces that define this trend (specific items, cuts, silhouettes)
2. Common brands or design aesthetics associated with it
3. How to style this trend (layering, combinations, accessories)
4. Color palettes and fabrics typically used
5. Celebrity or influencer associations
6. Where this trend is most popular (runway, street style, social media)
7. Styling tips and how to incorporate it into everyday wear

Make it detailed, specific, and actionable for someone wanting to adopt this style. Focus on FASHION details, not just social media popularity.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a fashion expert analyst. Provide detailed, specific fashion insights about trends, clothing items, styling, and brands. Focus on actionable fashion advice.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const enhancedDescription = aiData.choices?.[0]?.message?.content || trend.description;
        
        enhancedTrends.push({
          ...trend,
          description: enhancedDescription,
          source: 'AI-Enhanced Fashion Analysis'
        });
        
        console.log(`Enhanced trend: ${trend.name}`);
      } else {
        console.error(`Failed to enhance trend ${trend.name}: ${response.status}`);
        enhancedTrends.push({
          ...trend,
          source: 'TikTok Fashion Data'
        });
      }
      
      // Small delay between AI calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error enhancing trend ${trend.name}:`, error);
      enhancedTrends.push({
        ...trend,
        source: 'TikTok Fashion Data'
      });
    }
  }
  
  return enhancedTrends;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting trend scraping process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let trendingStyles: any[];

    try {
      console.log('Scraping real trends from TikTok...');
      const tiktokData = await scrapeTrendsFromTikTok();
      let extractedTrends = extractTrendsFromTikTokData(tiktokData);
      trendingStyles = await enhanceTrendsWithAI(extractedTrends);
      console.log(`Extracted and enhanced ${trendingStyles.length} fashion trends`);
    } catch (tiktokError) {
      console.error('TikTok scraping failed, falling back to default trends:', tiktokError);
      const defaultTrends = getDefaultTrends();
      trendingStyles = await enhanceTrendsWithAI(defaultTrends);
    }

    // Insert trends into database (cleaned data only)
    const { data, error } = await supabase
      .from('trends')
      .upsert(trendingStyles, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error inserting trends:', error);
      console.error('Trends data:', JSON.stringify(trendingStyles, null, 2));
      throw error;
    }

    // Store historical data for each trend
    if (data && data.length > 0) {
      const historyRecords = data.map(trend => ({
        trend_id: trend.id,
        popularity_score: trend.popularity_score,
        recorded_at: new Date().toISOString(),
      }));

      const { error: historyError } = await supabase
        .from('trend_history')
        .insert(historyRecords);

      if (historyError) {
        console.error('Error inserting trend history:', historyError);
      } else {
        console.log(`Stored historical data for ${historyRecords.length} trends`);
      }
    }

    console.log(`Successfully scraped and stored ${data?.length || 0} trends`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCount: data?.length || 0,
        trends: data,
        source: 'tiktok',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in scrape-trends function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getDefaultTrends(): any[] {
  return [
    {
      name: "Y2K Revival",
      description: "Early 2000s fashion revival featuring low-rise jeans, baby tees, rhinestones, velour tracksuits, and butterfly accessories. Think Paris Hilton and Britney Spears era with platform shoes and tiny handbags.",
      tags: ["y2k", "vintage", "nostalgic", "2000s"],
      source: "TikTok",
      popularity_score: 95
    },
    {
      name: "Cottagecore Aesthetic",
      description: "Romantic countryside aesthetic with flowy dresses, floral patterns, lace details, puffed sleeves, and nature-inspired accessories. Embraces a whimsical, pastoral lifestyle with vintage-inspired pieces.",
      tags: ["cottagecore", "floral", "romantic", "vintage"],
      source: "Instagram",
      popularity_score: 88
    },
    {
      name: "Clean Girl Aesthetic",
      description: "Minimal, polished look with slicked-back bun hairstyles, dewy makeup, gold hoop earrings, neutral-toned outfits, and an effortlessly chic vibe. Focus on groomed appearance and simple elegance.",
      tags: ["minimal", "clean", "elegant", "neutral"],
      source: "TikTok",
      popularity_score: 92
    },
    {
      name: "Gorpcore",
      description: "Outdoor gear meets street style with technical fabrics, hiking boots, utility vests, cargo pants, and functional fashion pieces. Combines practicality with urban aesthetic.",
      tags: ["outdoor", "functional", "sporty", "technical"],
      source: "Instagram",
      popularity_score: 85
    },
    {
      name: "Barbiecore",
      description: "All-pink maximalist aesthetic with hot pink outfits, feminine silhouettes, playful accessories, and bold, confident styling. Popularized by the Barbie movie trend.",
      tags: ["pink", "feminine", "playful", "bold"],
      source: "TikTok",
      popularity_score: 90
    },
    {
      name: "Quiet Luxury",
      description: "Understated wealth aesthetic featuring high-quality basics, neutral colors, perfect tailoring, minimal branding, and timeless pieces. Emphasis on craftsmanship over logos.",
      tags: ["minimal", "luxury", "neutral", "timeless"],
      source: "Instagram",
      popularity_score: 87
    },
    {
      name: "Balletcore",
      description: "Ballet-inspired fashion featuring wrap cardigans, leg warmers, soft pink tones, delicate ribbons, and graceful silhouettes. Channels the elegance of ballet dancers.",
      tags: ["ballet", "feminine", "soft", "dance"],
      source: "TikTok",
      popularity_score: 83
    },
    {
      name: "Coastal Grandmother",
      description: "Relaxed, sophisticated style inspired by beach house living with linen fabrics, wide-leg pants, neutral tones, straw hats, and effortlessly elegant pieces.",
      tags: ["coastal", "relaxed", "linen", "sophisticated"],
      source: "Instagram",
      popularity_score: 80
    }
  ];
}
