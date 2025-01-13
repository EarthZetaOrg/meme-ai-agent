import { TwitterApi, ApiResponseError, ApiRequestError, ApiPartialResponseError } from 'twitter-api-v2';
import { elizaLogger } from "@ai16z/eliza";
import { PriceMonitor } from '../market/analysis/priceMonitor';
export class TwitterService {
    // Inside TwitterService class
    async postTweet(content, options = {}) {
        try {
            // Validate content
            if (!content) {
                throw new Error('Tweet content cannot be empty');
            }
            if (content.length > 280) {
                throw new Error('Tweet exceeds 280 characters');
            }
            // Handle media if provided
            const mediaIds = options.mediaUrls ? await this.uploadMedia(options.mediaUrls) : [];
            // Create tweet payload
            const tweetPayload = {
                text: content,
                ...(mediaIds.length && {
                    media: {
                        media_ids: mediaIds
                    }
                })
            };
            // Post tweet
            const result = await this.userClient.v2.tweet(tweetPayload);
            elizaLogger.success(`Tweet posted successfully! ID: ${result.data.id}`);
        }
        catch (error) {
            elizaLogger.error('Failed to post tweet:', error);
            throw error;
        }
    }
    async postTweetWithRetry(content) {
        let attempt = 0;
        let lastError;
        while (attempt < this.config.maxRetries) {
            try {
                elizaLogger.info(`Attempting to post tweet (attempt ${attempt + 1}/${this.config.maxRetries})`);
                await this.postTweet(content);
                return;
            }
            catch (error) {
                lastError = error;
                attempt++;
                if (error instanceof ApiResponseError) {
                    if (error.code === 429) { // Rate limit hit
                        const resetTime = this.getRateLimitReset(error);
                        if (resetTime) {
                            const waitTime = resetTime - Date.now();
                            if (waitTime > 0) {
                                elizaLogger.warn(`Rate limit hit. Waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
                                await this.delay(waitTime);
                                continue;
                            }
                        }
                    }
                }
                if (attempt < this.config.maxRetries) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt);
                    elizaLogger.warn(`Tweet failed. Retrying in ${delay}ms...`);
                    await this.delay(delay);
                }
            }
        }
        throw new Error(`Failed to post tweet after ${this.config.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    }
    async uploadMedia(urls) {
        try {
            // Limit to maximum 4 media items per tweet
            const mediaUrls = urls.slice(0, 4);
            const mediaIds = await Promise.all(mediaUrls.map(async (url) => {
                try {
                    return await this.userClient.v1.uploadMedia(url);
                }
                catch (error) {
                    elizaLogger.error(`Failed to upload media from URL ${url}:`, error);
                    throw error;
                }
            }));
            return mediaIds;
        }
        catch (error) {
            elizaLogger.error('Failed to upload media:', error);
            throw error;
        }
    }
    userClient;
    appClient;
    aiService;
    //private jupiterService: JupiterPriceV2Service;
    //private heliusService: HeliusService;
    isStreaming = false;
    config;
    userId;
    MONTHLY_TWEET_LIMIT = 3000; // Define the monthly tweet limit
    dataProcessor;
    priceMonitor;
    marketUpdateInterval = null;
    constructor(config, aiService, dataProcessor) {
        this.validateConfig(config);
        this.config = {
            ...config,
            mockMode: config.mockMode ?? false,
            maxRetries: config.maxRetries ?? 3,
            retryDelay: config.retryDelay ?? 5000,
            baseUrl: config.baseUrl ?? 'https://api.twitter.com', // Add default baseUrl
            contentRules: {
                maxEmojis: config.contentRules?.maxEmojis ?? 0,
                maxHashtags: config.contentRules?.maxHashtags ?? 0,
                minInterval: config.contentRules?.minInterval ?? 300000
            },
            marketDataConfig: {
                updateInterval: config.marketDataConfig?.updateInterval ?? 60000,
                volatilityThreshold: config.marketDataConfig?.volatilityThreshold ?? 0.05,
                heliusApiKey: config.marketDataConfig?.heliusApiKey ?? ''
            },
            tokenAddresses: config.tokenAddresses ?? []
        };
        this.aiService = aiService;
        this.dataProcessor = dataProcessor;
        //this.jupiterService = jupiterService;
        //this.heliusService = heliusService;
        this.priceMonitor = new PriceMonitor(dataProcessor, aiService);
        this.setupMarketMonitoring();
        // Initialize clients with OAuth 2.0 authentication
        this.userClient = new TwitterApi({
            appKey: config.apiKey,
            appSecret: config.apiSecret,
            accessToken: config.accessToken,
            accessSecret: config.accessSecret
        });
        // Initialize app-only client
        this.appClient = new TwitterApi(config.bearerToken);
    }
    validateConfig(config) {
        const requiredFields = [
            'apiKey', 'apiSecret',
            'accessToken', 'accessSecret',
            'bearerToken',
            'oauthClientId', 'oauthClientSecret',
            'baseUrl'
        ];
        const missing = requiredFields.filter(field => !config[field]);
        if (missing.length > 0) {
            throw new Error(`Missing required Twitter configuration fields: ${missing.join(', ')}`);
        }
    }
    setupMarketMonitoring() {
        // Handle significant price movements
        this.priceMonitor.on('significantMovement', async ({ tokenAddress, analysis }) => {
            try {
                const marketData = await this.dataProcessor.formatForAI(tokenAddress);
                const content = await this.aiService.generateResponse({
                    content: `Generate market movement tweet:\n${marketData}\nAnalysis: ${analysis}`,
                    platform: 'twitter',
                    author: 'system',
                });
                await this.tweet(content);
            }
            catch (error) {
                elizaLogger.error('Failed to tweet market movement:', error);
            }
        });
        // Handle price alerts
        this.priceMonitor.on('alertTriggered', async ({ alert, pricePoint }) => {
            try {
                const marketData = await this.dataProcessor.formatForAI(alert.token);
                const content = await this.aiService.generateResponse({
                    content: `Generate price alert tweet:\n${marketData}\nAlert: ${alert.condition} at ${pricePoint.price}`,
                    platform: 'twitter',
                    author: 'system',
                });
                await this.tweet(content);
            }
            catch (error) {
                elizaLogger.error('Failed to tweet price alert:', error);
            }
        });
    }
    async startMarketUpdates(tokenAddress, interval = 1800000 // 30 minutes
    ) {
        try {
            // Start price monitoring
            await this.priceMonitor.startMonitoring(tokenAddress);
            // Schedule regular market updates
            this.marketUpdateInterval = setInterval(async () => {
                try {
                    const formattedData = await this.dataProcessor.formatForAI(tokenAddress);
                    const content = await this.aiService.generateResponse({
                        content: `Generate market update tweet with this data:\n${formattedData}`,
                        platform: 'twitter',
                        author: 'system',
                    });
                    await this.tweet(content);
                }
                catch (error) {
                    elizaLogger.error('Failed to post market update:', error);
                }
            }, interval);
            elizaLogger.info(`Started market updates for ${tokenAddress}`);
        }
        catch (error) {
            elizaLogger.error('Failed to start market updates:', error);
            throw error;
        }
    }
    async stopMarketUpdates() {
        if (this.marketUpdateInterval) {
            clearInterval(this.marketUpdateInterval);
            this.marketUpdateInterval = null;
        }
        // Cleanup price monitor
        this.priceMonitor.cleanup();
        elizaLogger.info('Market updates stopped');
    }
    async publishMarketUpdate(data) {
        try {
            const formattedData = await this.dataProcessor.formatForAI(data.tokenAddress);
            const content = await this.aiService.generateResponse({
                content: `Generate market update tweet with this data:\n${formattedData}`,
                platform: 'twitter',
                author: 'system',
            });
            await this.tweet(content);
        }
        catch (error) {
            elizaLogger.error('Failed to publish market update:', error);
            throw error;
        }
    }
    async initialize() {
        try {
            elizaLogger.info('Initializing Twitter service...');
            if (!this.config.mockMode) {
                await this.initializeWithRetry();
            }
            elizaLogger.success('Twitter service initialized successfully');
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            elizaLogger.error('Failed to initialize Twitter service:', msg);
            throw error;
        }
    }
    async initializeWithRetry(maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                await this.verifyUserAuth();
                return;
            }
            catch (error) {
                attempt++;
                if (error instanceof ApiResponseError && error.code === 429) {
                    const resetTime = this.getRateLimitReset(error);
                    if (resetTime) {
                        const waitTime = resetTime - Date.now();
                        if (waitTime > 0) {
                            elizaLogger.info(`Rate limit hit. Waiting ${Math.ceil(waitTime / 1000)} seconds before retry...`);
                            await this.delay(waitTime);
                            continue;
                        }
                    }
                }
                throw error;
            }
        }
        throw new Error(`Failed to initialize after ${maxRetries} attempts`);
    }
    getRateLimitReset(error) {
        try {
            const resetHeader = error.rateLimit?.reset;
            if (resetHeader) {
                return resetHeader * 1000; // Convert to milliseconds
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async verifyUserAuth() {
        try {
            const me = await this.userClient.v2.me();
            this.userId = me.data.id;
            elizaLogger.success(`User authentication verified for @${me.data.username}`);
        }
        catch (error) {
            this.handleAuthError(error, 'User authentication');
            throw error;
        }
    }
    handleAuthError(error, context) {
        if (error instanceof ApiResponseError) {
            switch (error.code) {
                case 401:
                    elizaLogger.error(`${context} failed: Unauthorized. Check your credentials.`);
                    break;
                case 403:
                    elizaLogger.error(`${context} failed: Forbidden. Check your API permissions.`);
                    break;
                case 429:
                    elizaLogger.error(`${context} failed: Rate limit exceeded. Try again later.`);
                    break;
                default:
                    elizaLogger.error(`${context} failed with code ${error.code}:`, error.data);
            }
        }
        else if (error instanceof ApiRequestError) {
            elizaLogger.error(`${context} failed: Request error.`, error.requestError);
        }
        else if (error instanceof ApiPartialResponseError) {
            elizaLogger.error(`${context} failed: Partial response error.`, error.responseError);
        }
        else {
            elizaLogger.error(`${context} failed with unexpected error:`, error);
        }
    }
    async tweet(content, options = {}) {
        if (this.config.mockMode) {
            elizaLogger.info('Mock mode - logging tweet:', content);
            return { data: { id: 'mock_tweet_id', text: content } };
        }
        await this.validateTweetContent(content);
        let attempt = 0;
        while (attempt < this.config.maxRetries) {
            try {
                const mediaIds = options.mediaUrls ? await this.uploadMedia(options.mediaUrls) : [];
                const tweetPayload = {
                    text: content,
                    ...(mediaIds.length && { media: { media_ids: mediaIds } }),
                    ...(options.replyToTweetId && { reply: { in_reply_to_tweet_id: options.replyToTweetId } })
                };
                const tweet = await this.userClient.v2.tweet(tweetPayload);
                elizaLogger.success('Tweet posted successfully:', tweet.data.id);
                return tweet;
            }
            catch (error) {
                attempt++;
                if (this.shouldRetry(error, attempt)) {
                    await this.delay(this.config.retryDelay * attempt);
                    continue;
                }
                elizaLogger.error('Failed to post tweet:', error);
                throw error;
            }
        }
        throw new Error(`Failed to post tweet after ${this.config.maxRetries} attempts`);
    }
    validateTweetContent(content) {
        const { maxEmojis = 0, maxHashtags = 0 } = this.config.contentRules;
        const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
        const hashtagCount = (content.match(/#/g) || []).length;
        if (emojiCount > maxEmojis) {
            throw new Error(`Tweet contains too many emojis. Maximum allowed is ${maxEmojis}.`);
        }
        if (hashtagCount > maxHashtags) {
            throw new Error(`Tweet contains too many hashtags. Maximum allowed is ${maxHashtags}.`);
        }
    }
    shouldRetry(error, attempt) {
        return (attempt < this.config.maxRetries &&
            error instanceof ApiResponseError &&
            (error.rateLimitError || error.code === 429));
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async startStream() {
        if (this.isStreaming) {
            elizaLogger.warn('Twitter stream is already running');
            return;
        }
        try {
            elizaLogger.info('Starting Twitter stream...');
            await this.setupStreamRules();
            const stream = await this.appClient.v2.searchStream({
                'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
                'user.fields': ['username'],
                expansions: ['referenced_tweets.id', 'author_id']
            });
            this.isStreaming = true;
            elizaLogger.success('Twitter stream started successfully');
            stream.on('data', this.handleStreamData.bind(this));
            stream.on('error', this.handleStreamError.bind(this));
        }
        catch (error) {
            // If we get a 403 error, disable streaming
            if (error instanceof ApiResponseError && error.code === 403) {
                elizaLogger.warn(`
          Stream setup failed due to insufficient API access.
          Streaming has been disabled.
          Basic tweet functionality will continue to work.
        `);
            }
            else {
                this.handleStreamSetupError(error);
                throw error;
            }
        }
    }
    async setupStreamRules() {
        try {
            const rules = await this.appClient.v2.streamRules();
            if (rules.data?.length) {
                await this.appClient.v2.updateStreamRules({
                    delete: { ids: rules.data.map(rule => rule.id) }
                });
            }
            const me = await this.userClient.v2.me();
            await this.appClient.v2.updateStreamRules({
                add: [
                    { value: `@${me.data.username}`, tag: 'mentions' }
                ]
            });
            elizaLogger.success('Stream rules configured successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to configure stream rules:', error);
            throw error;
        }
    }
    async handleStreamData(tweet) {
        try {
            if (!this.userId) {
                const me = await this.userClient.v2.me();
                this.userId = me.data.id;
            }
            if (tweet.data.author_id === this.userId)
                return;
            const response = await this.aiService.generateResponse({
                content: tweet.data.text,
                platform: 'twitter',
                author: tweet.data.author_id,
            });
            if (response) {
                await this.tweet(response, { replyToTweetId: tweet.data.id });
                elizaLogger.info('Successfully replied to tweet');
            }
        }
        catch (error) {
            elizaLogger.error('Error processing stream data:', error);
        }
    }
    handleStreamError(error) {
        elizaLogger.error('Stream error:', error);
        this.isStreaming = false;
        setTimeout(() => {
            if (!this.isStreaming) {
                this.startStream().catch(e => elizaLogger.error('Failed to restart stream:', e));
            }
        }, this.config.retryDelay);
    }
    handleStreamSetupError(error) {
        if (error instanceof ApiResponseError) {
            switch (error.code) {
                case 403:
                    elizaLogger.error(`
            Stream setup failed: Access forbidden
            Please ensure your App is configured for all required permissions
            Visit: https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api
          `);
                    break;
                case 429:
                    elizaLogger.error('Stream setup failed: Rate limit exceeded. Please try again later.');
                    break;
                default:
                    elizaLogger.error('Stream setup failed:', error);
            }
        }
        else {
            elizaLogger.error('Unexpected error during stream setup:', error);
        }
    }
    async stop() {
        elizaLogger.info('Twitter service stopped');
    }
    tweetCount = 0;
    getTweetCount() {
        return this.tweetCount;
    }
    getRemainingTweets() {
        return this.MONTHLY_TWEET_LIMIT - this.getTweetCount();
    }
}
