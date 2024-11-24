let files = [];

// Set up drag and drop handlers
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const convertButton = document.getElementById('convertButton');
const status = document.getElementById('status');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(fileList) {
    files = Array.from(fileList).filter(file => file.name.endsWith('.json'));
    convertButton.disabled = files.length === 0;
    status.textContent = `${files.length} JSON files selected`;
}

convertButton.addEventListener('click', async () => {
    try {
        status.textContent = 'Creating database...';
        status.style.display = 'block';

        initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        }).then(async function(SQL) {
        
            // Create a new database
            const db = new SQL.Database();
            
            // Create the streaming_history table
            db.run(`
                CREATE TABLE streaming_history (
                    ts TEXT,
                    platform TEXT,
                    ms_played INTEGER,
                    conn_country TEXT,
                    ip_addr TEXT,
                    master_metadata_track_name TEXT,
                    master_metadata_album_artist_name TEXT,
                    master_metadata_album_album_name TEXT,
                    spotify_track_uri TEXT,
                    episode_name TEXT,
                    episode_show_name TEXT,
                    spotify_episode_uri TEXT,
                    reason_start TEXT,
                    reason_end TEXT,
                    shuffle BOOLEAN,
                    skipped BOOLEAN,
                    offline BOOLEAN,
                    offline_timestamp TEXT,
                    incognito_mode BOOLEAN
                )
            `);

            // Process each JSON file
            for (const file of files) {
                const content = await readFileAsync(file);
                const data = JSON.parse(content);
                const CHUNK_SIZE = 1000;
                
                // Process records in chunks
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    const columns = Object.keys(chunk[0]);
                    
                    let query = `INSERT INTO streaming_history (${columns.join(', ')}) VALUES `;
                    let values = [];
                    
                    chunk.forEach((record, index) => {
                        query += '(';
                        for (const key in record) {
                            if (record[key] !== null && record[key] !== undefined) {
                                query += '?, ';
                                values.push(record[key]);
                            } else {
                                query += 'null, ';
                            }
                        }
                        query = query.slice(0, -2) + ')';
                        
                        if (index < chunk.length - 1) {
                            query += ', ';
                        }
                    });

                    db.run(query, values);
                    
                    // Update status with progress
                    status.textContent = `Processing ${file.name}: ${Math.min((i + CHUNK_SIZE), data.length)} of ${data.length} records...`;
                }
            }

            // Export the database
            const data = db.export();
            const blob = new Blob([data], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = 'spotify_history.db';
            a.click();
            
            URL.revokeObjectURL(url);
            status.textContent = 'Conversion complete! Database downloaded.';
        });
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        console.error(error);
    }
});

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}