const request = require('../utils/await-request');
const config = require('../../config');
const logger = require('winston');

module.exports = {
    loadImage: async imageUrl => {
        try {
            const imgRes = await request({url: imageUrl, encoding: null});
            if (imgRes.response.statusCode == 200) {
                // head request first
                if (!imgRes.response.headers['content-length'] || (imgRes.response.headers['content-length'] < config.IMAGE_MAX_BYTES)) {
                    return {
                        url: imageUrl,
                        data: imgRes.body.toString('base64'),
                        contentType: imgRes.response.headers['content-type']
                    };
                } else {
                    throw new Error(`The image is too large. Content length: ${imgRes.response.headers['content-length']}`);
                }
            } else {
                throw new Error(`Cannot download image. Status code: ${imgRes.response.statusCode}`);
            }
        } catch (error) {
            logger.error(`An error occurred while processing product image from url ${imageUrl}`);
            logger.error(error.message);
        }
    },
    removeUrlParams: (url, paramNames) => {
        let res = url.split('?')[0];
        let param;
        let paramsArr = [];
        const queryString = (url.indexOf('?') !== -1) ? url.split('?')[1] : '';
        if (queryString !== '') {
            paramsArr = queryString.split('&');
            for (let i = paramsArr.length - 1; i >= 0; i -= 1) {
                param = paramsArr[i].split('=')[0];
                for (const key in paramNames) {
                    const paramName = paramNames[key];
                    if (param === paramName) {
                        paramsArr.splice(i, 1);
                    }
                }
            }
            res = res + '?' + paramsArr.join('&');
        }
        return res;
    }
}