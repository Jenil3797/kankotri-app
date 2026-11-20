// Global State
let uploadedFiles = []; // Stores { name, bytes }
let customFontBytes = null; // Stores user-uploaded TTF buffer

// DOM Elements
const adminToggle = document.getElementById('admin-toggle');
const adminSection = document.getElementById('admin-section');
const templateUpload = document.getElementById('template-upload');
const uploadedFilesList = document.getElementById('uploaded-files-list');
const guestFileSelection = document.getElementById('guest-file-selection');
const engNameInput = document.getElementById('eng-name');
const gujNameInput = document.getElementById('guj-name');
const generateBtn = document.getElementById('generate-btn');
const customFontUpload = document.getElementById('custom-font-upload');

// 1. Admin Toggle
adminToggle.addEventListener('click', () => {
    adminSection.classList.toggle('hidden');
});

// 2. Custom Font Upload (Admin)
customFontUpload.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        customFontBytes = await e.target.files[0].arrayBuffer();
        alert("Custom font loaded successfully!");
    }
});

// 3. Handle PDF Uploads
templateUpload.addEventListener('change', async (e) => {
    uploadedFiles = [];
    uploadedFilesList.innerHTML = '';
    
    for (let file of e.target.files) {
        if (file.type !== 'application/pdf') continue;
        const arrayBuffer = await file.arrayBuffer();
        uploadedFiles.push({ name: file.name, bytes: arrayBuffer });
        
        const div = document.createElement('div');
        div.textContent = `📄 ${file.name}`;
        uploadedFilesList.appendChild(div);
    }
    renderGuestFileSelection();
    checkFormValidity();
});

// 4. Render Checkboxes & Radio Buttons for Guest Selection
function renderGuestFileSelection() {
    guestFileSelection.innerHTML = '';
    if (uploadedFiles.length === 0) {
        guestFileSelection.innerHTML = '<em>Upload templates first.</em>';
        return;
    }

    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';

        // Checkbox to include file
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `include-${index}`;
        checkbox.value = index;
        checkbox.checked = true; // Default include all

        // Radio to mark as 'Main' (where name is stamped)
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'main-file';
        radio.value = index;
        radio.id = `main-${index}`;
        if (index === 0) radio.checked = true; // Default first as main

        const label = document.createElement('label');
        label.htmlFor = `include-${index}`;
        label.innerHTML = `<strong>Include</strong> | Stamp Name: `;
        
        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(radio);
        item.appendChild(document.createTextNode(` - ${file.name}`));
        
        guestFileSelection.appendChild(item);
    });
}

// 5. Transliteration (English to Gujarati)
engNameInput.addEventListener('input', (e) => {
    const text = e.target.value;
    // Using standard 'itrans' for English phonetics to Gujarati via Sanscript
    const transliterated = Sanscript.t(text, 'itrans', 'gujarati');
    gujNameInput.value = transliterated;
    checkFormValidity();
});

document.getElementById('phone-number').addEventListener('input', checkFormValidity);

function checkFormValidity() {
    const phone = document.getElementById('phone-number').value;
    const name = gujNameInput.value;
    if (uploadedFiles.length > 0 && phone.length === 10 && name.trim() !== '') {
        generateBtn.disabled = false;
    } else {
        generateBtn.disabled = true;
    }
}

// 6. Generate PDFs and Send
generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = "Processing...";

    try {
        const { PDFDocument, rgb } = PDFLib;
        const gujName = gujNameInput.value;
        
        // Admin Configs
        const posX = parseInt(document.getElementById('pos-x').value);
        const posY = parseInt(document.getElementById('pos-y').value);
        const fontSize = parseInt(document.getElementById('font-size').value);

        // Fetch Default Font if custom is not uploaded
        let fontBytesToUse = customFontBytes;
        if (!fontBytesToUse) {
            // Note: For GitHub Pages, you must place the TTF in assets/fonts/
            const fontUrl = './assets/fonts/NotoSerifGujarati-Regular.ttf'; 
            const fontRes = await fetch(fontUrl);
            if(!fontRes.ok) throw new Error("Could not load default font. Upload a custom font in Admin Settings.");
            fontBytesToUse = await fontRes.arrayBuffer();
        }

        const zip = new JSZip();
        
        // Find selected files and main file
        const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
        const mainFileRadio = document.querySelector('input[name="main-file"]:checked');
        const mainFileIndex = mainFileRadio ? parseInt(mainFileRadio.value) : -1;

        for (let cb of checkboxes) {
            const index = parseInt(cb.value);
            const file = uploadedFiles[index];

            if (index === mainFileIndex) {
                // Stamp the Main PDF
                const pdfDoc = await PDFDocument.load(file.bytes);
                
                // Register Fontkit
                pdfDoc.registerFontkit(window.fontkit);
                const customFont = await pdfDoc.embedFont(fontBytesToUse);

                const pages = pdfDoc.getPages();
                const firstPage = pages[0];

                firstPage.drawText(gujName, {
                    x: posX,
                    y: posY,
                    size: fontSize,
                    font: customFont,
                    color: rgb(0, 0, 0)
                });

                const modifiedPdfBytes = await pdfDoc.save();
                zip.file(`Personalized_${file.name}`, modifiedPdfBytes);
            } else {
                // Add static PDF as-is
                zip.file(file.name, file.bytes);
            }
        }

        // Generate Zip
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = `${engNameInput.value}_Kankotri.zip`;
        downloadLink.click();

        // Open WhatsApp
        const phone = document.getElementById('phone-number').value;
        const waMessage = encodeURIComponent(`જય શ્રી કૃષ્ણ,\nઅમે અમારા લગ્ન પ્રસંગે આપને હાર્દિક આમંત્રણ પાઠવીએ છીએ. કૃપા કરીને આમંત્રણ પત્રિકા સ્વીકારશો.\n\nઆભાર,\n[તમારું નામ]`);
        const waUrl = `https://wa.me/91${phone}?text=${waMessage}`;
        window.open(waUrl, '_blank');

    } catch (error) {
        console.error(error);
        alert("Error generating PDF: " + error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate & Send via WhatsApp";
    }
});
