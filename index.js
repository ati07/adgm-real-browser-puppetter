import { connect } from 'puppeteer-real-browser'
import fs from 'fs'

function waitforme(millisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, millisec);
    })
}

const helperFunction = async (newBaseUrl, elements) => {
    var tempData = [];
    // Extracting and logging the text content of each element
    for (const element of elements) {
        // console.log('element',element)sc-i1odl-0
        const identity = await element.$(".PostingCardLayout-sc-i1odl-0.egwEUc")
        const id = await identity?.evaluate(node => node.getAttribute('data-id')) ?? '';
        if (id == undefined || id == null) return '';
        // div.LocationAddress-sc-ge2uzh-0.dYbGQf.postingAddress
        const title = await element.$('div.LocationAddress-sc-ge2uzh-0')
        const t = await title?.evaluate(node => node.innerText) ?? '';

        const location = await element.$("h2[data-qa='POSTING_CARD_LOCATION']")
        const l = await location?.evaluate(node => node.innerText) ?? '';

        const description = await element.$("h3[data-qa='POSTING_CARD_FEATURES'] span")
        const d = await description?.evaluate(node => node.innerText) ?? '';

        const price = await element.$('.Price-sc-12dh9kl-3.geYYII')
        const r = await price?.evaluate(node => node.innerText) ?? ''
        const dollar = r?.includes("USD") ? 18 : 1;
        // console.log('d', dollar)
        const formattedPricing = r?.replaceAll("MN", "")?.replaceAll(",", "")?.replaceAll("USD", "")?.trim();

        const di = await element.$('h3.PostingMainFeaturesBlock-sc-1uhtbxc-0.cHDgeO')
        const dimedimensionsCard = await di?.evaluate(node => node.innerText) ?? ''

        let formattedMeter = dimedimensionsCard?.trim();
        if (formattedMeter.includes("m²")) {
            formattedMeter = parseFloat(formattedMeter.replaceAll("m²", "").trim());
        } else if (formattedMeter.includes("ha")) {
            formattedMeter = parseFloat(formattedMeter.replaceAll("ha", "").trim()) * 10000;
        }

        const pricingPerMeter = formattedPricing / (formattedMeter * dollar);

        const anchorElement = await element.$('h3[data-qa="POSTING_CARD_DESCRIPTION"] a');
        // console.log('a',anchorElement)
        let url =  anchorElement 
        ? await anchorElement.evaluate(node => node.getAttribute('href')) 
        : null;


        // const elementText = await page.evaluate(element => element.$eval('sc-12dh9kl-3 iqNJlX',node => node.innerText), element);
        tempData.push({
            'page': newBaseUrl,
            'url':url,
            'id': id,
            'title': t,
            'pricing': formattedPricing,
            'location': l,
            'description': d,
            'm2': formattedMeter ?? 1,
            'pricingPerMeter': pricingPerMeter ?? 0
        });


    }
    // console.log('tempData', tempData, tempData.length)
    return tempData
}
const clusterBrowser = async () => {
    const callBackFunction = async () =>{
        let data = await connect({
            headless: 'auto',
            fingerprint: true,
            tf: true, // If a feature you want to use at startup is not working, you can initialize the tf variable false and update it later.
            turnstile: true,
            // proxy: {
            //     host: '',
            //     port: '',
            //     username: '',
            //     password: ''
            // }
        })
            .then(async response => {
                const { page, browser, setTarget } = response
                
                let baseUrl = 'https://www.inmuebles24.com/terrenos-en-venta-en-santiago.html'
                newBaseUrl = `${baseUrl.split('.html')[0]}-pagina-9999.html`;
                await page.goto(newBaseUrl, { waitUntil: "domcontentloaded", timeout: 100000 });
                setTarget({ status: true })
                try{
                    await page.waitForSelector('.postings-container');
                    var url = page.url();
                    var pagination = url.match(/-pagina-(\d+)\.html/);
                    setTarget({ status: false })
                }catch(e){
                    await browser.close()
                    await callBackFunction()
                }
                
                console.log('pagination[1]', pagination[1])
                var currentPageLoop = 3;
                var newBaseUrl;
                var returnData = [];
                for (let i = 1; i < parseInt(pagination[1]) + 1; i++) {
                    console.log('i', i)
                    newBaseUrl = `${baseUrl.split('.html')[0]}-pagina-${i}.html`;
                    console.log("currentPageLoop", newBaseUrl)
                   
                    const callback = async (newBaseUrl) => {
                        let p = await browser.newPage()
                        let Data;
                        try {
                            
                            const client = await p.target().createCDPSession();
                            await client.send('Network.clearBrowserCache');
                            await client.send('Network.clearBrowserCookies');
                            console.log('Cache is cleared')
                            await p.goto(newBaseUrl, { waitUntil: "domcontentloaded", timeout: 100000 });
                            setTarget({ status: true })
                            // Waiting for a specific element to be generated by JavaScript 
                            await p.waitForSelector('.CardContainer-sc-1tt2vbg-5.fvuHxG');
    
                            const elements = await p.$$('.CardContainer-sc-1tt2vbg-5.fvuHxG');
                            // console.log('elements', elements.length)
                            setTarget({ status: false })
                            Data = await helperFunction(newBaseUrl, elements)
                            // console.log('data', Data)
                            
                            
                        } catch (error) {
                            console.log("trycatch1", error)
                            setTarget({ status: false })
                            await callback(newBaseUrl)
                        }
                        await p.close()
                        return Data
                    }
                    // if (i === 1) {
    
                    
                    let rData = await callback(newBaseUrl)
                    console.log('rD',rData)
                    if(rData){
                        for(let i of rData){
                        returnData.push(i)
                        await fs.promises.appendFile('link.txt', i.url + '\n', 'utf8');
                    }
                    }
                    
                    
    
                }
                await browser.close()
                return returnData
            })
            .catch(error => {
                console.log(error.message)
                return "Something went wrong.Try After Sometime or Contact to Developer"
            })
        return data
    }

    await callBackFunction()
}
await clusterBrowser().then((res) => {
    console.log('res', res, res.length)
})


