const puppeteer = require("puppeteer");
const influencer = require("./tiktok_influencer");
const fs = require("fs");

function scrollPage(page) {
  return page.evaluate(() => {
    // Page evaluate's scope is the page.
    // You have to pass args as a second parameter to evalute, but functions come up undefined.
    // https://stackoverflow.com/questions/46088351/puppeteer-pass-variable-in-evaluate
    let interval;
    let scrollTop = 0;
    const scrollBottom = 100;

    const intervalRate = 100;
    const pageDocument = document.documentElement;
    // this needs to hang until the interval clears
    // or the script will just move on to the waitFor below.
    return new Promise(resolve => {
      function scroll() {
        if (scrollTop + scrollBottom < pageDocument.scrollHeight) {
          scrollTop += scrollBottom;
          window.scroll(0, scrollTop);
        } else {
          clearInterval(interval);
          resolve(window.data);
        }
      }
      interval = setInterval(scroll, intervalRate);
    });
  });
}


// https://stackoverflow.com/questions/64948077/how-to-reload-and-wait-for-an-element-to-appear
async function waitForSelectorWithReload(page, selector) {
    const MAX_TRIES = 5;
    let tries = 0;
    while (tries <= MAX_TRIES) {
      try {
        const element = await page.waitForSelector(selector, {
          timeout: 5000,
        });
        return element;
      } catch (error) {
        if (tries === MAX_TRIES) throw error;

        tries += 1;
        void page.reload();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
      }
    }
  }

(async() => {
	try {
		let data_influencer = []
		const browser = await puppeteer.launch({
			// headless: false,
			defaultViewport: null
		})
		let page = await browser.newPage();
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36 WAIT_UNTIL=load")

		for(let i = 0; i < influencer.username.length; i++) {
			try{
				await page.goto(`https://www.tiktok.com/${influencer.username[i].Username}`);
				await scrollPage(page);

				let data = await page.evaluate(async () => {

					let post = Array.from(document.querySelectorAll(".tiktok-x6y88p-DivItemContainerV2")).map(el => {

						let number = Number(el.querySelector(".video-count").textContent.replace(".", "").replace("K", "000").replace("M", "000000").replace("B", "000000000"));
						let link = el.querySelector(".tiktok-x6f6za-DivContainer-StyledDivContainerV2 a").getAttribute("href");

						return {
							number: number,
							link: link
						}
					});

					const views = post.map((post) => {
						return post.number;
					})

					const video_views = views.reduce((total, num) => {
						return total + num;
					})

					const links = post.map((post) => {
						return post.link;
					})

					return {
						links: links,
						Posts: post.length,
						Views: video_views,
					};
				})

				let total_comments = 0;
				let total_shares = 0;

				// const page2 = await browser.newPage();

				for(let j = 0; j < data.links.length; j++) {
					await page.goto(data.links[j])
					let unavail;

					try {
						unavail = await page.waitForSelector(".tiktok-u2vwc1-DivErrorWrapper", {
							timeout: 1000
						})
					} catch(e){

					}

					if (unavail) {
						continue;
					}

					await waitForSelectorWithReload(page, "strong[data-e2e='comment-count']")
					const stats = await page.evaluate(() => {
						let comment = Number(document.querySelector("strong[data-e2e='comment-count']").textContent.replace(".", "").replace("K", "000").replace("M", "000000").replace("B", "000000000"));
						let shares = document.querySelector("strong[data-e2e='share-count']").textContent;

						if (shares === 'Share') {
							shares = 0;
						} else {
							shares = Number(shares.replace(".", "").replace("K", "000").replace("M", "000000").replace("B", "000000000"));
						}

						return {
							comment: comment,
							share: shares
						}
					})
					total_comments += stats.comment,
					total_shares += stats.share
				}

				data = {
					Username: influencer.username[i].Username,
					Posts: data.Posts,
					Views: data.Views,
					Comments: total_comments,
					Shares: total_shares
				}

				data_influencer[data_influencer.length] = data;
				console.log(data);
			}catch(err) {
				const data = {
					Username: influencer.username[i].Username,
					Posts: null,
					Views: null,
					Comment: null,
					Shares: null
				}

				data_influencer[data_influencer.length] = data;
				console.log(data);
				console.error(err);
			}
		}

		fs.writeFile("data.json", JSON.stringify(data_influencer), (err) => {
			if (err) {
				console.error(err)
			}
		});
		console.log(data_influencer);
		await browser.close();
	} catch(err) {
		console.error(err);
	}
})();
