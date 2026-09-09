/**
 * The current article file.
 *
 * Articles are split across numbered files so no single one grows past reading
 * size. This is the one the daily post is appended to; when it reaches roughly
 * forty articles a new file starts and `index.js` picks it up alongside the
 * others. Order inside a file does not matter - `index.js` sorts on the date.
 */
export const BLOG_ARTICLES_4 = [
  {
    slug: 'what-a-plumbers-website-has-to-do',
    title: "What a Plumber's Website Has to Do",
    excerpt:
      'A burst pipe at 11pm is not a browsing session. The seven things a plumbing website has to get right in the ninety seconds before someone calls the next result.',
    category: 'Tips for Owners',
    date: 'August 28, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: "A plumber's website has one job: get the person standing in an inch of water to call before they try the next result. That person is in their laundry room with their phone in one hand. They are not reading your About page. They are not admiring your hero photo. They have about ninety seconds of patience and three tabs open, and whichever plumber makes calling easiest is the one who gets the job.",
      },
      {
        type: 'p',
        text: 'That is the whole brief. Everything a plumbing website does either helps that person call you or gets in their way. Most of what follows we learned on trades that look nothing like plumbing, where the caller arrives in exactly the same state.',
      },
      { type: 'h2', text: 'Where Does the Phone Number Go?' },
      {
        type: 'p',
        text: 'It goes in the header, on every page, as a link that dials when tapped. Not an image of a number. Not a number sitting in a footer four scrolls down. <strong>A tappable number in the top right corner of every page.</strong>',
      },
      {
        type: 'p',
        text: 'Dickinson Bayou Fleeting runs coastal barge fleeting and waterfront dock leasing on Galveston Bay, and their site was built to one requirement: put a dispatcher one tap away from any screen, including a phone holding one bar out on a dock. Five pages, no cookie banner, nothing standing between a visitor and the number. A plumbing site has the same job on a shorter fuse.',
      },
      {
        type: 'p',
        text: 'Then say when you answer it. "24/7 emergency" is worth more than any headline you could write, and if you do not run nights, saying "7am to 6pm, Monday to Saturday" is worth almost as much, because the person at 11pm stops wasting their time and yours.',
      },
      {
        type: 'p',
        text: 'Faded Barber Shop, up in Liberty, takes appointments Tuesday through Thursday and walk-ins on Friday. That one difference was what most callers were ringing to find out, so every day on the page carries its own label. A plumber has three or four facts in that same shape, and every one the page answers is a call that never has to happen.',
      },
      { type: 'h2', text: 'Which Towns Do You Name?' },
      {
        type: 'p',
        text: 'Plumbing is a driving business. The first thing a caller wants to know after your number is whether you will come out to them. So the towns go on the page in plain words: Baytown, Highlands, Mont Belvieu, Crosby, Channelview. Not "the greater Houston area." A person searching does not think in metro areas, they think in the name of the place they live.',
      },
      {
        type: 'p',
        text: 'It matters to Google for the same reason. When somebody types "water heater repair Mont Belvieu," Google is looking for a page that says those words and means them. A site that names its towns and gives the bigger ones a page of their own will beat a site that says "serving the surrounding areas" every time.',
      },
      { type: 'h2', text: 'Does Every Job Need Its Own Page?' },
      {
        type: 'p',
        text: 'Yes. Nobody searches for "plumber" when they know what is wrong. They search for "water heater leaking," "slab leak," "sewer camera inspection," "garbage disposal replacement," "repipe cost." Each of those is a different person with a different problem and a different budget.',
      },
      {
        type: 'p',
        text: 'Compound Industrial Scale Services in Huffman sells parts alongside its calibration work: load cells, printers, junction boxes, test weights, mounting hardware. Every one of those has a page of its own at an address of its own, so a search for a component name arrives on the component rather than on a services list that happens to mention it.',
      },
      {
        type: 'p',
        text: 'The trades work the same way. One Services page with eight bullet points catches none of that traffic. A real page per job, saying what it costs, how long it takes, and what you tend to find when you get there, catches all of it, and it is usually the one change an owner can see in the call log.',
      },
      { type: 'h2', text: 'Which Photos Belong on the Site?' },
      {
        type: 'p',
        text: 'Stock photos of a smiling man with a wrench do nothing. A phone photo of the repipe you finished on Tuesday does a lot. It proves you exist, it proves you do this work, and it gives the person on the other end something to compare their own problem against.',
      },
      {
        type: 'p',
        text: 'You do not need a photographer. You need the habit of taking two pictures on every job, one before and one after, and somewhere to put them. Six months of that and you have a portfolio most plumbers in your market do not.',
      },
      { type: 'h2', text: 'Where Do the Reviews Go?' },
      {
        type: 'p',
        text: 'Google reviews decide whether you appear in the map pack, and the map pack is where most of the emergency calls come from. Get them onto the site too, with the customer\'s first name and their town next to the words. "Karen T., Highlands" reads as a real person. "Satisfied Customer" reads as something you typed yourself.',
      },
      { type: 'h2', text: 'How Fast Does It Have to Load?' },
      {
        type: 'p',
        text: 'Fast enough to open on cell data in a metal-sided garage on a phone at four percent, because that is where the person in the flooded laundry room is. A site that takes six seconds to appear has already lost. This is where template sites fall down: the builder loads a pile of code the page never uses, and on a weak signal that pile is the whole difference between a call and a back button.',
      },
      {
        type: 'p',
        text: 'Every site we build gets tested the same way before it goes live, throttled to a slow mobile connection on a real phone, with one question being asked: is the number tappable before the page has finished loading. If you have to wait for a page to settle before you can call it, the page is broken, however good it looks on a laptop.',
      },
      { type: 'h2', text: 'Does a Plumber Need a Quote Form?' },
      {
        type: 'p',
        text: 'Yes, for the unhurried half of the business: the remodel, the water softener, the "we are thinking about it next spring" job. Those people will happily type. The emergency will not. So the form exists, it is short, and it never stands between anybody and the phone number.',
      },
      {
        type: 'p',
        text: 'Short means name, phone, and what is wrong. Every extra field is another reason to close the tab. And whatever it collects has to reach you somewhere you look, which sounds obvious until you meet the number of trade sites mailing their leads to an inbox nobody has opened since launch. We test that path on every build and again on every change, because a form that silently stops working is worse than no form at all.',
      },
      { type: 'h2', text: 'What Does This Add Up To?' },
      {
        type: 'p',
        text: 'A plumbing website is not a brochure and it is not a portfolio. It is a dispatch tool. Number at the top, hours stated, towns named, one page per job, real photos, real reviews, and fast enough to open in a garage with one bar of signal.',
      },
      {
        type: 'p',
        text: 'Get those seven things right and you are ahead of nearly every plumber in your county, many of whom are running a template from 2019 that takes five seconds to load and hides the phone number behind a hamburger menu. If you want to know which of the seven yours is missing, send us the address.',
      },
    ],
  },
  {
    slug: 'hvac-the-two-seasons-your-website-has-to-be-ready-for',
    title: 'HVAC: The Two Seasons Your Website Has to Be Ready For',
    excerpt:
      'A dead air conditioner in July and a furnace tune-up in November want different things from one HVAC website. The homepage leads with the season it is in.',
    category: 'Tips for Owners',
    date: 'August 29, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: 'An HVAC website has to be ready for two seasons, and they want opposite things from it. A window unit is not an option in a Texas August, and the family whose central air quit at two in the afternoon is not comparing five HVAC companies on their merits. They are typing "AC repair near me" and calling whichever site answers the question fastest. Six months later, in a cold snap that lasts three days a year, that same household is not in a hurry at all. They are deciding whether the furnace tune-up they put off in October is worth doing now.',
      },
      {
        type: 'p',
        text: 'Same business, same website, two completely different visitors. Most HVAC sites are built for one of them and lose the other.',
      },
      { type: 'h2', text: 'What Does the July Caller Need?' },
      {
        type: 'p',
        text: 'Someone whose air conditioning has failed in July heat behaves exactly like the plumber\'s caller with a burst pipe: phone in hand, patience gone, looking for the fastest yes. The number has to be tappable from the header on every page, and the page has to say plainly whether you run same-day service, because "we\'ll get someone out this week" reads as a no to a person standing in a ninety-degree living room.',
      },
      {
        type: 'p',
        text: 'Say the response window in hours, not adjectives. <strong>"Same-day service, most calls answered within two hours" tells a hot, frustrated homeowner something they can act on.</strong> "Fast, reliable service" tells them nothing, because every competitor\'s site says the same three words.',
      },
      { type: 'h2', text: 'What Does the October Visitor Need?' },
      {
        type: 'p',
        text: 'The visitor thinking about a fall tune-up, a system replacement, or a maintenance plan is not in a hurry and does not want to be rushed. They are comparing what a plan costs, what it covers, and whether it is worth paying for a service call before anything has broken. Push them toward a phone call before they have that information and most of them close the tab instead.',
      },
      {
        type: 'p',
        text: "That visitor wants a real page: what a maintenance plan includes, what a tune-up costs versus what a breakdown costs, and how a fifteen-year-old unit's efficiency stacks up against a new one. A form works fine for this half of the business, because nobody comparing a maintenance plan minds typing an email address.",
      },
      { type: 'h2', text: 'How Does One Site Serve Both?' },
      {
        type: 'p',
        text: 'The mistake is building a site around whichever mood the owner remembers best, usually the emergency, because that is the call that sticks. A homepage that only shouts "24/7 EMERGENCY SERVICE" in July reads as exactly the wrong message to the person pricing a new system in October, and a homepage built entirely around maintenance plans is useless to someone standing next to a dead unit in August.',
      },
      {
        type: 'p',
        text: 'The fix is a homepage that leads with whichever mood matches the season, and a maintenance page and an emergency page that both stay one tap away from it all year. Every build we do keeps the seasonal push as a single line in the site\'s own content rather than something baked into the layout, so switching the homepage from "same-day AC repair" to "get your furnace ready for winter" is a five-minute edit in October and again in April, not a redesign.',
      },
      { type: 'h2', text: 'Should You Have a Filter Size Page?' },
      {
        type: 'p',
        text: 'Yes. People search for the filter size stamped on the old one, 16x25x1 or 20x20x1, far more often than anyone expects, and almost no HVAC site answers it. A short page naming the common sizes, how often to change them, and where to buy them costs an afternoon to write and catches a steady trickle of searches that has nothing to do with an emergency and everything to do with someone who will remember your name in July.',
      },
      { type: 'h2', text: 'Should Brand Names Go on the Site?' },
      {
        type: 'p',
        text: 'Yes. Homeowners search the brand stamped on their own unit, Trane, Carrier, Rheem, Goodman, Lennox, especially when they are trying to figure out whether it is worth repairing or replacing. If you are certified on particular brands or carry certain manufacturers, say so on a page of its own rather than a logo strip in the footer nobody reads. It answers a real question and it is free ranking for terms your competitors are not bothering to claim.',
      },
      { type: 'h2', text: 'Which Reviews Go on the Homepage?' },
      {
        type: 'p',
        text: 'A five-star review about a furnace repair carries less weight in July than one about AC, and the reverse in January. Rotating which reviews the homepage shows to match the season it is showing them in is a small thing, and it is the kind of small thing that makes a site feel current rather than parked.',
      },
      { type: 'h2', text: 'What Do the Two Seasons Add Up To?' },
      {
        type: 'p',
        text: 'An HVAC website is two websites sharing one address: an emergency dispatch tool for half the year and a considered-purchase brochure for the other half, plus a scattering of small, specific pages that catch the searches neither mood accounts for: filter sizes, brand pages, financing.',
      },
      {
        type: 'p',
        text: 'Get the homepage to lead with the season it is in, keep both paths one tap from anywhere, and answer the small specific questions nobody else bothers to, and the site earns calls in both the busy months and the quiet ones.',
      },
    ],
  },
  {
    slug: 'reading-a-web-design-quote-what-each-line-should-mean',
    title: 'Reading a Web Design Quote: What Each Line Should Mean',
    excerpt:
      'Every web design quote uses the same five or six line items. What each one is supposed to buy, and the phrasing that means it has not been thought through yet.',
    category: 'Business',
    date: 'August 30, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: 'Every web design quote you get back looks roughly the same: a handful of line items, a number next to each, a total at the bottom. Design, development, content, hosting, revisions. The words are so familiar that most owners stop reading them and go straight to the total, which is exactly how a vague quote survives being sent.',
      },
      {
        type: 'p',
        text: 'Each of those lines is supposed to buy something specific. When it does not say what, that is the line to ask about before you sign anything.',
      },
      { type: 'h2', text: 'Can You Judge a Quote by the Total?' },
      {
        type: 'p',
        text: 'No. Two quotes can both say "$4,000" and mean completely different things. One includes five real pages, your own photos, and a form that gets tested before launch. The other includes a template with your logo dropped in and three stock photos nobody checked for a competitor already using them. The total does not tell you which one you are looking at. The line items do, if they say enough to be checked.',
      },
      { type: 'h2', text: 'What Should "Design" Buy?' },
      {
        type: 'p',
        text: 'Design should name what gets designed: how many unique page layouts, whether mobile is a separate pass or an afterthought, and how many rounds of changes are included before extra ones cost more. <strong>"Custom design" on its own means nothing, so ask to see two or three past sites from the same designer and judge the word by the work, not the label.</strong>',
      },
      { type: 'h2', text: 'What Should "Development" Say?' },
      {
        type: 'p',
        text: 'This is where a quote should say what platform the site runs on and who owns the code once it is built. A quote that never names the platform is often piecing together plugins on WordPress, which is fine to buy, but you should know that is what you are buying and what it will cost every year to keep those plugins updated and working.',
      },
      { type: 'h2', text: 'Who Writes the Content?' },
      {
        type: 'p',
        text: 'Somebody has to write the words on every page, and this line says who. If it does not say, the quote is assuming you will write it, which is a real cost even if no dollar figure sits next to it. Plan for the hours or ask what it costs to have it written for you.',
      },
      { type: 'h2', text: 'What Does "Hosting" Include?' },
      {
        type: 'p',
        text: 'This line should say what it keeps running: the server, the SSL certificate, backups, and whoever answers when the site goes down. Every quote we send names what "hosting" includes, the server, the certificate, backups and monitoring, rather than the single word, because the single word is where a client finds out six months later that "hosting" meant a server and nothing else. A monthly number with no list behind it is a number you cannot compare to anyone else\'s.',
      },
      { type: 'h2', text: 'What Do "Revisions" Cover?' },
      {
        type: 'p',
        text: 'This is the line that starts the real argument later, because "unlimited revisions" sounds generous and is usually the opposite. A shop offering unlimited revisions on a fixed price has to make each round faster to stay profitable, which means your third round of feedback gets less attention than your first. A quote naming a set number of rounds, with extra rounds priced plainly, is usually the more honest one, even though it reads as the smaller offer.',
      },
      { type: 'h2', text: 'Which Words Mean It Has Not Been Scoped?' },
      {
        type: 'p',
        text: '"As needed," "typically," "in most cases," and "starting at" are the phrases that let a quote avoid committing to anything. They are not always a red flag on their own. A "starting at" price on a template package is honest if the template itself never changes price. Stacked together across every line, though, they describe a quote nobody has thought through for your business yet. Ask what the number becomes once it is scoped to your five pages, your photos, your deadline, and get that in writing before you pay anything.',
      },
      { type: 'h2', text: 'What Does a Good Quote Look Like?' },
      {
        type: 'p',
        text: 'A quote worth signing names the pages by title, not by count. "Home, Services, About, Service Areas, Contact" reads as a plan; "5 pages" reads as a placeholder. It says who owns the site\'s code and content once it is paid for. It says what happens after launch: who fixes something that breaks, and what that costs. And it says a number for everything that has one, rather than folding a few things into "and more" at the end.',
      },
      {
        type: 'p',
        text: "None of this requires knowing anything about web development. It requires reading the quote the same way you would read a contractor's estimate, line by line, asking what each one buys, instead of reading the number at the bottom and deciding from that alone. Any quote you are holding can go back with these questions before you sign it, and any quote we send is written to answer them on the first read.",
      },
    ],
  },
  {
    slug: 'roofers-the-storm-week-your-website-either-handles-or-not',
    title: 'Roofers: The Storm Week Your Website Has to Handle',
    excerpt:
      'A hail line rolls through Baytown and by morning half the neighborhood is calling roofers. The roofing site that answers first wins the week.',
    category: 'Tips for Owners',
    date: 'August 30, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: "A roofer's website earns most of its year in a handful of storm weeks, and it either handles them or it does not. A hail line rolls through Baytown on a Tuesday afternoon, and by Wednesday morning half the neighborhood is on the phone. The people whose roofs held are pricing an inspection they had been putting off. The people whose ceilings are dripping are calling anyone who answers.",
      },
      {
        type: 'p',
        text: 'Both of them found you the same way: they typed something into Google and tapped the first result that did not make them scroll before it gave them a phone number.',
      },
      { type: 'h2', text: 'Can a Thumb Reach the Number?' },
      {
        type: 'p',
        text: 'Nothing else on the page matters if the phone number is not the first thing a thumb can reach. Put it in the header on every page, put it big, and make it a tel: link so tapping it dials. A number written as plain text next to the words "call today" reads on a phone the way "please leave a message" reads on a machine. <strong>Every roofer\'s site in Baytown has a phone number somewhere on it; the ones that book the storm work have one that dials from the top of the screen without a scroll.</strong>',
      },
      { type: 'h2', text: 'Does Emergency Tarping Need Its Own Page?' },
      {
        type: 'p',
        text: 'Yes. Someone whose living room ceiling is coming down does not want a free inspection scheduled for Friday. They want a tarp on the roof before it rains again tonight. If you do emergency tarping, that belongs on a page of its own, named on the menu, and priced or at least bracketed in dollars. <strong>"Emergency services available" is not a page. It is a line that reads like nobody has ever called about it.</strong> A page that says "tarp installed within four hours for two hundred and fifty dollars, credited toward the repair" reads like a business that has done this before, because it has.',
      },
      { type: 'h2', text: 'What Should the Insurance Page Say?' },
      {
        type: 'p',
        text: "The most common question a homeowner has after a storm is not what the roof costs. It is whether their insurance will pay for it, and how the claim gets filed. Most roofers' sites are silent on that. <strong>A page that says plainly what a claim looks like is worth more than any headline about quality: the adjuster, the deductible, the supplements, the depreciation, how long a check takes.</strong> It answers the fear the person is sitting with, and it separates the roofers who have handled a thousand claims from the ones who are hoping the customer figures it out.",
      },
      { type: 'h2', text: 'Which Photos Should a Roofer Use?' },
      {
        type: 'p',
        text: 'Your own. The photograph on a roofing site of a smiling family in front of a two-story colonial in autumn colors is not from Baytown, and everyone looking at it knows. A phone photo of a hail-dented shingle you pulled off a house on Loop 201, next to the new one, is worth ten of them. So is a photo of your crew tarping a roof in the dark with a headlamp on. People trust what looks like the neighborhood they live in. <strong>Stock photography is a way of telling them you have never worked in it.</strong>',
      },
      { type: 'h2', text: 'Why Does the Google Map Matter More?' },
      {
        type: 'p',
        text: 'The three roofers Google shows on a map when someone searches after a storm get most of the calls, and almost none of that has to do with the website. The Google Business Profile is filled out, the address matches the website exactly down to the "Suite" abbreviation, and the reviews are recent and answered. <strong>A roofer whose website is beautiful but whose Business Profile still lists the phone number from before the last office move loses to the one whose site is plain and whose Profile is right.</strong> On every build we do, we cross-check the Profile and the website against each other before launch, same address, same hours, same phone number, same service area, so a storm week does not turn up a mismatch nobody noticed in April.',
      },
      { type: 'h2', text: 'Which Reviews Do Homeowners Read?' },
      {
        type: 'p',
        text: "The recent ones, not the average. A four-point-nine over four hundred reviews with nothing posted in a year reads as a business that peaked. A four-point-six with a fresh review from last month, and the owner's answer under it, reads as a business someone can call today. Ask for a review after every job, and answer the ones you get, whether they are five stars or two. <strong>The answer under a bad one is read by ten people who will never post a review of their own, and it is where they decide whether to call.</strong>",
      },
      { type: 'h2', text: 'What Does the Site Do Between Storms?' },
      {
        type: 'p',
        text: 'Storm weeks pay the year, but the year has fifty-one other weeks in it, and a roofer whose site only speaks to an emergency is quiet through all of them. The pages that earn calls between storms are the ones about the boring parts of the work: what a full replacement involves, how long a repair lasts, what happens on the day the crew shows up, what a warranty covers and what it does not. Those pages catch the homeowner who noticed a curled shingle from the yard and started thinking about it. <strong>That homeowner is not in a hurry, which means they are the person most likely to compare three roofers before they call one, and the roofer whose site answered their question is the one they pick.</strong>',
      },
      { type: 'h2', text: 'What Does the Storm Week Add Up To?' },
      {
        type: 'p',
        text: "A roofer's website has to hold two moods and hand off between them without a rebuild. In storm week it is a dispatch tool: number in the header, tarp service on the menu, insurance page a tap away, photographs from the storm itself if you can get them up fast enough. Between storms it is a considered-purchase brochure: what the work is, what it costs, what stands behind it, and enough about the crew that a stranger feels like they already know who is going to show up.",
      },
      {
        type: 'p',
        text: "Get the phone number where a thumb finds it, write the insurance page, keep the Business Profile in the same state as the website, and put your own storm work on the page instead of somebody else's happy colonial, and the site does the job it was built for on the week that matters most.",
      },
    ],
  },
  {
    slug: 'why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
    title: 'Why Your Site Is Fast on Your Laptop and Slow on a Phone',
    excerpt:
      'Your site snaps up on your laptop and stalls on a phone in a truck in Mont Belvieu. The phone has a tenth of the processor, and the images are the fix.',
    category: 'Site Speed',
    date: 'August 31, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: 'Your site is fast on your laptop and slow on a phone because the phone has a tenth of the processor, none of the cache, and a signal that drops. You open your site on your laptop in the morning and everything works. The page arrives before your finger leaves the mouse. That afternoon a customer taps the same page from her truck in Mont Belvieu and stares at a white screen while the search result she came from waits behind her thumb. She backs out. You never hear from her.',
      },
      {
        type: 'p',
        text: 'The site did not break. It was slow on her phone for the same reasons it will be slow on the next one, and none of them show up on the machine you built the site on.',
      },
      { type: 'h2', text: "How Different Is the Customer's Phone?" },
      {
        type: 'p',
        text: 'The laptop you tested on has ten times the processor of the mid-range Android she is holding, and it has been sitting on a wired or full-signal connection for hours. Her phone is a two-hundred-dollar device from two years ago running a browser with fifteen tabs open, a battery below thirty percent, and one bar of LTE at the edge of a warehouse. The same page has to render on both, and the phone has to do it with a tenth of the processor, a fraction of the memory bandwidth, and a signal that drops packets every few seconds.',
      },
      {
        type: 'p',
        text: '<strong>The people who buy from you are almost never on your setup.</strong> For a service business in the Baytown area, most first-time visits arrive on a phone, on a cell connection, from a Google Maps or Search tap. The person searching for a plumber is not at a desk.',
      },
      { type: 'h2', text: 'What Loads When Somebody Taps the Link?' },
      {
        type: 'p',
        text: 'When she taps the link her phone starts a chain nobody watches. The domain resolves. The server sends the HTML. The HTML tells the browser to fetch a stylesheet, a font file, two more fonts, a slideshow script, a chat widget, a cookie banner, an analytics tag, a tracking pixel for the ad platform you tried last spring, and eight images sized for the desktop version. Every one of those is a separate request over her spotty connection, every one waits its turn, and <strong>the page cannot show anything readable until enough of them have arrived.</strong>',
      },
      {
        type: 'p',
        text: 'On your laptop this happens too, but the browser cached most of it on your last visit and the connection carries the rest in the time it takes the mouse to move. On her phone, nothing is cached, and the connection is the bottleneck rather than the processor.',
      },
      { type: 'h2', text: 'Why Does It Look Fine to You?' },
      {
        type: 'p',
        text: 'Because you never load the site cold. You visit it from the address bar with the previous session still in memory, from a browser that has already fetched the fonts and the icons a dozen times this week. <strong>The first paint you see is not the first paint a customer sees.</strong> Open a private window on the phone in your pocket and try it. If you have never done that away from the office wifi, do it today.',
      },
      { type: 'h2', text: 'Which Files Do the Most Damage?' },
      {
        type: 'p',
        text: 'The images. A homepage often ships four to six megabytes of them that a phone screen shows at a fraction of the original size. The camera on a modern phone shoots at four thousand pixels wide; a homepage hero on a phone displays at maybe four hundred. If nobody told the site to send the smaller version, it sends the big one, and the phone spends three seconds decoding a picture the screen will crop away.',
      },
      {
        type: 'p',
        text: '<strong>This is the single biggest fix on most small business sites, and it is also the one that never shows up when the site is tested on office wifi.</strong> The bytes are the same; the wait is not.',
      },
      { type: 'h2', text: 'What Else Is Loading?' },
      {
        type: 'p',
        text: 'Every plugin, chat bubble, review widget, and marketing pixel that got added to the site to try is still loading, and each one blocks the phone until it finishes. The abandoned A/B test script from last year is running on every page today. The heat-map tool the previous developer installed is fetching a two-hundred-kilobyte library before the phone can render the menu. Some of these were paid for and forgotten; most were free and added on a whim. <strong>All of them are being downloaded by every customer who taps your link.</strong>',
      },
      {
        type: 'p',
        text: 'A quick audit tends to find several of these on a small business site, and removing them costs nothing.',
      },
      { type: 'h2', text: 'How Do I Test It Before Launch?' },
      {
        type: 'p',
        text: "On every site we ship, we open the page on a two-year-old Android on a throttled connection before the domain switches over. Not the browser's phone-emulator, which uses your desktop's processor and reports numbers nobody's customer sees. A real handset, tethered to a slow cell profile, held in a hand. If the page reads inside two seconds on that setup, it reads for the person tapping a Maps pin in a parking lot. <strong>If it does not, the domain does not move until it does.</strong>",
      },
      { type: 'h2', text: 'How Do You See What Customers See?' },
      {
        type: 'p',
        text: 'You do not need a developer to check this. Open Chrome on your phone, tap the three-dot menu, choose New Incognito Tab, and type your domain in. That skips the cache and shows you what an arriving visitor sees. If you can, do it once on wifi and once with wifi off. <strong>If the wifi version is fast and the cell version is a slideshow, you have found what a stranger tapping the ad has been finding.</strong>',
      },
      {
        type: 'p',
        text: "The other free tool is Google's own PageSpeed Insights. It runs your page on a simulated mid-range phone and hands back a number and a list. Ignore the score and read the list. The line that says image files are larger than they need to be is worth more than the rest of the report combined.",
      },
      { type: 'h2', text: 'What Can You Fix This Week?' },
      {
        type: 'p',
        text: "If you own the site and can only do one thing, ask whoever built it to compress the images and switch on the newer image format the browser already supports. <strong>That fix alone often takes more off a homepage's weight than any other single change, and it stops the phone from throwing away seconds decoding pictures nobody sees at full size.</strong>",
      },
      {
        type: 'p',
        text: 'If you cannot get hold of them, or the answer is a quote for a rebuild, take the free PageSpeed report to whoever manages your site and hand them the line about images. It is a short job on almost every platform, and it is the difference between a customer who reads your services page and a customer who backs out to the next result.',
      },
    ],
  },
  {
    slug: 'electricians-a-pricing-page-that-stops-tire-kicker-calls',
    title: 'Electricians: A Pricing Page That Stops Tire-Kicker Calls',
    excerpt:
      'An electrician does not have a lead problem, an electrician has a wrong-call problem. A pricing page does not price the jobs, it filters the calls.',
    category: 'Tips for Owners',
    date: 'September 1, 2026',
    readTime: '6 min read',
    content: [
      {
        type: 'p',
        text: 'An electrician does not have a lead problem. An electrician has a wrong-call problem. The phone rings and the person on the other end wants somebody to swap a light switch for thirty dollars, or to argue about whether a two-hour job should really cost two hours. Every one of those calls burns half a morning on the truck and on the front desk, and the caller was never going to book anyway.',
      },
      {
        type: 'p',
        text: '<strong>A pricing page does not price the jobs. It filters the calls, so the ones that come through are the ones you want.</strong>',
      },
      { type: 'h2', text: 'What Does "Call for a Quote" Cost You?' },
      {
        type: 'p',
        text: 'The caller you wanted. Most electrician sites treat pricing the way lawyers treat pricing, which is to hide it and hope the caller commits before they ask. That works for lawyers because a person calling a lawyer is already scared. A person calling an electrician has three tabs open and is comparing.',
      },
      {
        type: 'p',
        text: 'If your page says "call for a quote," the person who was hoping for a two-hundred-dollar answer calls you anyway, then argues, then leaves a review. <strong>The person who was hoping for a two-thousand-dollar answer calls the shop down the road whose page named a number.</strong>',
      },
      { type: 'h2', text: 'What Goes at the Top of the Page?' },
      {
        type: 'p',
        text: 'The service call fee. It is the one number the caller cares about most, because it tells them what they owe if they let you through the door. Ninety-five dollars, one hundred and twenty-five, one-fifty, whatever your number is. Put it in a box in the first screen of the page. Say what it includes: the drive out, the first thirty minutes of diagnosis, and the estimate. Say what it does not: parts, and the work itself. Say when it is waived: if they book the work you quoted, or never, whichever you do.',
      },
      {
        type: 'p',
        text: '<strong>This one number does more filtering than the rest of the page combined.</strong> The caller who was going to ask you to drive out to look at a broken outlet for free reads it and does not call. That is the win.',
      },
      { type: 'h2', text: 'Should You Publish Price Ranges?' },
      {
        type: 'p',
        text: '<strong>Yes. A caller who reads that panel upgrades typically run twenty-five hundred to forty-five hundred, depending on the panel size, the amperage, and whether the meter has to move, is a caller who has already priced themselves in or out before the phone rings.</strong> The number you name is not a bid. It is the shape of a bid, and that is what somebody with money in their pocket needs before they will pick up.',
      },
      {
        type: 'p',
        text: 'Do this for the six or seven jobs you get called for the most. Panel upgrade. EV charger install. Whole-house rewire on a two-bedroom. Ceiling fan swap. Adding a circuit. Generator interlock. Outlet-and-switch replacement on a room. If a job type is a third of your book, it belongs on the page with a range on it.',
      },
      { type: 'h2', text: 'Should You List the Jobs You Do Not Take?' },
      {
        type: 'p',
        text: 'Yes. A "we do not do" section is worth more than most owners think. If you do not do commercial, say so. If you do not do low-voltage or alarm systems, say so. If you do not take jobs under a two-hour minimum, say so. Every one of those lines stops a call you were going to end with the words "you might try somebody else." <strong>The caller reads it, closes the tab, and dials the next result, and neither of you spends the twelve minutes.</strong>',
      },
      { type: 'h2', text: 'Is a Minimum Job Size Rude?' },
      {
        type: 'p',
        text: 'No. A minimum job size, printed clearly, is the same tool used the other direction. A two-hour minimum with a specific number attached to it stops the caller who wanted you to change three bulbs. It is the shape of your business, and a caller who reads it and still books is a caller who understands the trip is not free and did not need you to spend a call explaining it.',
      },
      {
        type: 'p',
        text: '<strong>The callers who read it and do not book were not going to pay you either way. They were going to book and complain.</strong>',
      },
      { type: 'h2', text: 'What Is the Page For?' },
      {
        type: 'p',
        text: 'The page is for the caller sorting themselves before they get to you, whatever you charge. <strong>A shop that puts real numbers on the page ends up on the phone with people who read the numbers and are ready to move.</strong> A shop that hides the numbers ends up on the phone with people who wanted a different number, and the front desk absorbs the difference.',
      },
      { type: 'h2', text: 'Does the Form Reach Anybody?' },
      {
        type: 'p',
        text: "On every site we build, the contact form's mail has to arrive somewhere a person looks. We send a copy to a second address and check it the day the site goes live, then again a week later, because a form that silently drops leads is worse than no form. <strong>It is the check the trades who lose leads to a broken form never think to run, and it takes ten minutes.</strong>",
      },
      { type: 'h2', text: 'What Should You Leave Off?' },
      {
        type: 'p',
        text: 'The sentence "prices subject to change without notice." Every price on any page anywhere is subject to change. <strong>The sentence signals that you already know somebody is going to be upset, and it does more damage than any specific number would.</strong>',
      },
      {
        type: 'p',
        text: 'Leave off the paragraph about your certifications too. The caller assumes you are licensed and bonded. Put the license number in the footer where the state requires it and stop.',
      },
      { type: 'h2', text: 'What Should the First Screen Hold?' },
      {
        type: 'p',
        text: "The page's job is done in the first fifteen seconds, before the caller has scrolled. The service call fee, one or two ranges for the job type they came for, a line about what you do not take, and the phone number. Everything under that is for the caller who is already going to call. Put the FAQ there. Put the two paragraphs about how you handle old wiring. Put the photos of your work. <strong>But the top of the page is a filter and nothing else.</strong>",
      },
      { type: 'h2', text: 'What Does a Good Pricing Page Get You?' },
      {
        type: 'p',
        text: 'The measure of a good pricing page is not how many calls it produces. It is how few of the calls it produces are the wrong ones. Once a page like this goes up, a shop answers fewer calls and books a larger share of them. <strong>The front desk gets its mornings back, and the trucks stop rolling out to look at things nobody was going to hire them to fix.</strong> That is the win. If you want the page written, the service call fee, your six most common jobs with a range on each, and the list of what you do not take are all we need to start.',
      },
    ],
  },
]
