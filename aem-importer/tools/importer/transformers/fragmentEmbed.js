import { addSection, createBlock, getLink } from './util.js';

const createFragementEmbed = (main, document) => {
    const fragementEmbed = main.querySelector('#nuanMessagingFrame');
    if (!fragementEmbed) return;

    const content = '<div id="nuanMessagingFrame"></div><div id="embeddedchat"> \n' +
                    '<script type="text/javascript">\n' +
                    'var va_background="https://www.ups.com/assets/resources/images/Virtual_Assistant_Background_1200x350/VA_1200x350_Spring_2024_Image.jpg";\n' +
                    '</script>\n' +
                    '</div>';
    const preTag = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = content;
    preTag.append(code);
    const block = createBlock('Fragment Embed', [[preTag]]);
    fragementEmbed.append(block);
    addSection(block);
}

export default createFragementEmbed;