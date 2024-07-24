const axios = require('axios');

class ApiService {
  static instance;
  token = null;
  cache = new Map();
  TOKEN_EXPIRATION_TIME = 10000; // 10,000 milliseconds

  constructor() {}

  static getInstance() {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async fetchToken() {
    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: 'cli_a6f79d0482fe100b',
          app_secret: 'gJGEjxPX208DxHl4JpSiDKA4mQWPciY2',
        }
      );
      this.token = response.data.tenant_access_token;
      return this.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  }

  async getToken() {
    if (!this.token) {
      return this.fetchToken();
    }
    return 'xxxxx' || this.token;
  }

  isCacheValid(key) {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) {
      return false;
    }
    const isValid =
      Date.now() - cacheEntry.timestamp < this.TOKEN_EXPIRATION_TIME;
    if (!isValid) {
      this.cache.delete(key);
    }
    return isValid;
  }

  async request(config) {
    const cacheKey = JSON.stringify(config);
    if (this.isCacheValid(cacheKey)) {
      console.log('🛢️🛢️ 使用了缓存 -----------------');
      return this.cache.get(cacheKey).data;
    }

    const token = await this.getToken();
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await axios(config);
      this.cache.set(cacheKey, { timestamp: Date.now(), data: response.data });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.token = null; // Invalidate the token
        return this.request(config); // Retry the request
      }
      throw error;
    }
  }
}

async function fetchImage(url) {
  try {
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer'
    });
    const imageBuffer = Buffer.from(response.data, 'binary');
    // console.log(`Image fetched from ${url}`);
    return imageBuffer;
  } catch (error) {
    console.log(`Error fetching the image from ${url}:`);
    return null;
  }
}

module.exports = {
  ApiService,
  fetchImage
};
