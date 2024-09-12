const puppeteer = require('puppeteer');
const fs = require('fs');

// hasSubcategories показывает имеются ли категории на странице
async function hasSubcategories(page) {
    try {
        await page.waitForSelector('.catalog-department__redesigned-categories', { timeout: 5000 })

        return true
    } catch (error) {
        console.log(`---/ Нет вложенных категорий в этой категории`);
        return false;
    }
}

// fetchCategories возвращает информацию о категориях на странице
async function fetchCategories(browser, url) {
    const page = await browser.newPage()
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (!await hasSubcategories(page)) {
            await page.close()
            return [];
        }

        // Парсинг категорий на текущей странице
        const categories = await page.evaluate(() => {
            const categoryElements = document.querySelectorAll('.inverted-catalog-category');
            const categoriesData = [];

            // Проход по каждому найденной на странице карточке категории
            categoryElements.forEach(element => {
                const name = element.querySelector('.inverted-catalog-category__title')?.innerText.trim();

                // Получение URL
                const megaMarketUrl = element.querySelector('a')?.getAttribute('href');
                const fullMegaMarketUrl = megaMarketUrl ? `${window.location.origin}${megaMarketUrl}` : null;

                categoriesData.push({
                    name,
                    megaMarketUrl: fullMegaMarketUrl,
                    yandexMarketUrl: null,
                    subCategories: []
                });
            });

            return categoriesData;
        });

        await page.close()

        return categories;
    } catch (error) {
        console.error(`Ошибка при парсинге страницы: ${url}`, error);
        await page.close()
        return [];
    }
}

// parseCategoryRecursive рекурсивная функция для парсинга категорий и подкатегорий
async function parseCategoryRecursive(url) {
    // Подсчет страницы
    totalPages++;

    // Перезапуск браузера каждые pageCountForRestart страниц
    if (totalPages % pageCountForRestart === 0 && totalPages > 0) {
        console.log(`Достигнуто ${pageCountForRestart} страниц. Перезапуск браузера...`);
        await browser.close();
        browser = await puppeteer.launch({ headless: false });
    }

    const categories = await fetchCategories(browser, url);

    // Парсинг категории
    for (let category of categories) {
        if (category.megaMarketUrl) {
            console.log(`[${totalPages} стр] Переход в ${category.name}: ${category.megaMarketUrl}`);
            // Парсинг подкатегорий для категории
            category.subCategories = await parseCategoryRecursive(category.megaMarketUrl);
        }
    }

    return categories;
}

// scrape запускает парсер с начального URL и записывает результат его работы в файл
async function scrape(rootURL, fileName) {
    browser = await puppeteer.launch({ headless: false });

    console.log(`Парсинг начиная с ${rootURL}`)
    const categories = await parseCategoryRecursive(rootURL);

    await browser.close();

    fs.writeFileSync(fileName, JSON.stringify(categories, null, 2));
    console.log(`Парсинг завершен, данные сохранены в ${fileName}`);
}

// readConfig считывает данные из конфиг файла
function readConfig() {
    let config;
    try {
        const configData = fs.readFileSync('config.json');
        config = JSON.parse(configData);
        console.log('Конфигурация загружена:\n', config);
        rootURL = config.root_url
        fileName = config.file_name
        pageCountForRestart = config.page_count_for_restart
    } catch (error) {
        console.error('Ошибка при чтении config.json:', error);
        process.exit(1);
    }
}

async function main(){
    readConfig();
    scrape(rootURL, fileName);
}

// ПЕРЕМЕННЫЕ:

// Базовый URL сайта
let rootURL = 'https://megamarket.ru/catalog'

// Имя файла для сохранения директорий
let fileName = 'categories.json'

// Количество страниц, через которое будет происходить перезапуск
let pageCountForRestart = 100;

// Счетчик пройденных страниц для дальнейшего перезапуска браузера
let totalPages = 0;

// Глобальная переменная для браузера
let browser;

// ГЛАВНАЯ ФУНКЦИЯ:

// Инициализация
main()

// TODO: в мебели есть "показать все"