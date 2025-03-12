// 主入口文件
import { Router } from './utils/router.js';
import { ApiConnectionService } from './services/apiConnection.js';
import { ApiConfigService } from './services/apiConfig.js';
import { Sidebar } from './components/sidebar.js';
import { ApiCard } from './components/apiCard.js';
import { isMobile } from './utils/deviceUtils.js';

document.addEventListener('DOMContentLoaded', function() {
    // 初始化服务
    const apiConnection = new ApiConnectionService();
    const apiConfig = new ApiConfigService(apiConnection);
    const sidebar = new Sidebar();

    // 获取DOM元素
    const connectionSettings = document.getElementById('connection-settings');
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const connectButton = document.getElementById('connect-button');
    const apiConfigArea = document.getElementById('api-config-area');
    const content = document.getElementById('content');

    // 初始化路由
    const router = new Router({
        defaultRoute: () => {
            const apiContainer = document.getElementById('api-container');
            apiContainer.style.display = '';

            if (apiConnection.connection.isConnected) {
                connectionSettings.style.display = 'none';
                apiConfigArea.style.display = 'block';
                loadApiConfig();
            } else if (apiConnection.connection.url && apiConnection.connection.key) {
                connectionSettings.style.display = 'none';
                apiConfigArea.style.display = 'block';
                testConnectionAndLoadConfig();
            } else {
                connectionSettings.style.display = 'block';
                apiConfigArea.style.display = 'none';
            }
        }
    });

    // 设置路由
    router.addRoute('settings', () => {
        const apiContainer = document.getElementById('api-container');
        apiContainer.style.display = '';

        if (apiConnection.connection.isConnected) {
            connectionSettings.style.display = 'none';
            apiConfigArea.style.display = 'block';
            loadApiConfig();
        } else if (apiConnection.connection.url && apiConnection.connection.key) {
            connectionSettings.style.display = 'none';
            apiConfigArea.style.display = 'block';
            testConnectionAndLoadConfig();
        } else {
            connectionSettings.style.display = 'block';
            apiConfigArea.style.display = 'none';
        }
    });

    // 初始化连接表单
    if (apiConnection.connection.url) {
        apiUrlInput.value = apiConnection.connection.url;
    }
    if (apiConnection.connection.key) {
        apiKeyInput.value = apiConnection.connection.key;
    }

    // 修改：将点击事件改为表单提交事件
    const connectionForm = document.getElementById('connection-form');
    if (connectionForm) {
        connectionForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // 阻止表单默认提交行为

            // 获取输入的值
            const url = apiUrlInput.value.trim();
            const key = apiKeyInput.value.trim();

            // 验证输入
            if (!url) {
                alert('请输入服务器URL');
                return;
            }

            if (!key) {
                alert('请输入API Key');
                return;
            }

            // 显示加载状态
            connectButton.disabled = true;
            connectButton.innerHTML = '<span class="loading-spinner"></span> 连接中...';

            // 保存连接信息
            apiConnection.saveConnection(url, key);

            // 使用已有的测试连接函数
            await testConnectionAndLoadConfig();
        });
    }

    // 加载API配置
    async function loadApiConfig() {
        try {
            const apiContainer = document.getElementById('api-container');
            const apiCardsContainer = document.getElementById('api-cards-container');

            apiContainer.style.display = '';
            apiCardsContainer.innerHTML = '<div class="loading">加载提供商配置中...</div>';

            const data = await apiConfig.fetchConfig();
            apiCardsContainer.innerHTML = '';

            if (data.api_config && data.api_config.providers) {
                data.api_config.providers.forEach(provider => {
                    const apiCard = new ApiCard(provider);
                    apiCardsContainer.appendChild(apiCard.createCard());
                });
            }

            setupAddButton();
            setupSaveButton();
        } catch (error) {
            console.error('加载API配置失败:', error);
            const apiCardsContainer = document.getElementById('api-cards-container');
            apiCardsContainer.innerHTML = `<div class="error">加载配置失败: ${error.message}</div>`;
        }
    }

    // 设置添加按钮
    function setupAddButton() {
        const addButton = document.getElementById('add-api-button');
        const newButton = addButton.cloneNode(true);
        addButton.parentNode.replaceChild(newButton, addButton);

        newButton.addEventListener('click', () => {
            const apiCard = new ApiCard();
            document.getElementById('api-cards-container').appendChild(apiCard.createCard());
        });
    }

    // 设置保存按钮
    function setupSaveButton() {
        const saveButton = document.getElementById('save-config-button');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                const configData = collectApiConfigData();
                saveButton.disabled = true;

                try {
                    await apiConfig.saveConfig(configData);

                    // 使用模板更新按钮内容
                    const successTemplate = document.getElementById('save-success-template');
                    saveButton.innerHTML = successTemplate.innerHTML;

                    // 添加成功状态类
                    saveButton.classList.add('success');

                    // 1秒后恢复原始状态
                    setTimeout(() => {
                        saveButton.classList.remove('success');
                        const defaultTemplate = document.getElementById('save-default-template');
                        saveButton.innerHTML = defaultTemplate.innerHTML;
                        saveButton.disabled = false;
                    }, 1000);

                } catch (error) {
                    console.error('保存配置失败:', error);
                    alert(`保存配置失败: ${error.message}`);
                    saveButton.disabled = false;
                }
            });
        }
    }

    // 收集API配置数据
    function collectApiConfigData() {
        const providers = [];
        document.querySelectorAll('.api-card:not(.template)').forEach(card => {
            const provider = {
                provider: card.querySelector('.provider-name').value,
                base_url: card.querySelector('.base-url').value,
                tools: card.querySelector('.tools-checkbox').checked
            };

            // 收集API密钥
            const apiKeys = Array.from(card.querySelectorAll('.api-key-entry .api-key'))
                .map(input => input.value.trim())
                .filter(key => key);

            provider.api = apiKeys.length === 1 ? apiKeys[0] : apiKeys;

            // 收集模型
            provider.model = Array.from(card.querySelectorAll('.model-entry'))
                .map(entry => {
                    const originalName = entry.querySelector('.original-model-name').value;
                    const renamedName = entry.querySelector('.renamed-model-name').value;

                    if (originalName) {
                        return renamedName ? { [originalName]: renamedName } : originalName;
                    }
                })
                .filter(model => model);

            // 收集偏好设置
            const preferencesTextarea = card.querySelector('.preferences');
            if (preferencesTextarea && preferencesTextarea.value.trim()) {
                try {
                    provider.preferences = JSON.parse(preferencesTextarea.value.trim());
                } catch (e) {
                    console.error('解析偏好设置JSON失败:', e);
                }
            }

            // 收集备注
            if (card.querySelector('.note')) {
                provider.notes = card.querySelector('.note').value;
            }

            providers.push(provider);
        });

        return { providers };
    }

    // 添加：测试连接并加载配置
    async function testConnectionAndLoadConfig() {
        try {
            await apiConnection.testConnection();
            connectionSettings.style.display = 'none';
            apiConfigArea.style.display = 'block';
            loadApiConfig();
        } catch (error) {
            console.error('连接服务器失败:', error);
            alert(`连接服务器失败: ${error.message}`);

            // 恢复连接设置显示
            connectionSettings.style.display = 'block';
            apiConfigArea.style.display = 'none';

            // 恢复按钮状态
            connectButton.disabled = false;
            connectButton.innerHTML = '连接服务器';
        }
    }

    // 初始化路由
    router.init();

    // 移动端点击内容区域时关闭侧边栏
    content.addEventListener('click', (e) => {
        if (isMobile() && !e.target.closest('a')) {
            sidebar.sidebar.classList.remove('expanded');
        }
    });
});