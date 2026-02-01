import pdfMake from 'npm:pdfmake@0.2.7/build/pdfmake.js';
import pdfFonts from 'npm:pdfmake@0.2.7/build/vfs_fonts.js';

// Initialize pdfMake with fonts
pdfMake.vfs = pdfFonts.pdfMake.vfs;

// Configure fonts to support UTF-8
pdfMake.fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

// Central PDF Configuration
export const pdfConfig = {
    defaultStyle: {
        font: 'Roboto',
        fontSize: 10
    },
    styles: {
        header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10]
        },
        subheader: {
            fontSize: 14,
            bold: true,
            margin: [0, 10, 0, 5]
        },
        tableHeader: {
            bold: true,
            fontSize: 10,
            fillColor: '#eeeeee'
        },
        small: {
            fontSize: 8
        },
        total: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 0]
        }
    },
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 60, 40, 60]
};

// Test string for validation
export const validationString = 'Ä Ö Ü ä ö ü ß € Café Straße Größe Maß';

// Helper function to create PDF
export async function createPDF(docDefinition) {
    const doc = {
        ...docDefinition,
        defaultStyle: pdfConfig.defaultStyle,
        styles: { ...pdfConfig.styles, ...docDefinition.styles },
        pageSize: docDefinition.pageSize || pdfConfig.pageSize,
        pageOrientation: docDefinition.pageOrientation || pdfConfig.pageOrientation,
        pageMargins: docDefinition.pageMargins || pdfConfig.pageMargins
    };

    return new Promise((resolve, reject) => {
        try {
            const pdfDocGenerator = pdfMake.createPdf(doc);
            pdfDocGenerator.getBase64((data) => {
                resolve(data);
            });
        } catch (error) {
            reject(error);
        }
    });
}