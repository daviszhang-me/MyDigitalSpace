class PersonalWebsite {
    constructor() {
        this.currentUser = null;
        this.notes = [];
        this.workflows = [];
        this.currentFilter = 'all';
        this.currentWorkflowFilter = 'all';
        this.editingNoteId = null;
        this.editingWorkflowId = null;
        this.currentSection = 'personal'; // 'personal', 'knowledge', or 'workflow'
        this.currentPersonalPage = 'home';
        this.activeTagFilters = [];
        this.allTags = new Set();
        this.allWorkflowTags = new Set();
        this.isAuthenticated = false;
        this.authToken = localStorage.getItem('knowledgehub_auth_token');
        this.workflowStepCounter = 0;
        // Auto-detect API base URL based on current domain
        this.apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3001/api'
            : `${window.location.protocol}//${window.location.host}/api`;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupWorkflowEventListeners();
        await this.checkAuthStatus();
        
        // Always load notes for everyone (public access)
        await this.loadUserNotes();
        this.updateAllTags();
        this.renderNotes();
        this.updateCategoryCounts();
        this.updateTagFilters();
        this.updateKnowledgeStats();
        
        // Load workflows (public access)
        console.log('🚀 Starting workflow loading...');
        await this.loadWorkflows();
        console.log('🏷️ Updating workflow tags...');
        this.updateAllWorkflowTags();
        console.log('🎯 About to render workflows after loading...');
        this.renderWorkflows();
        console.log('📊 Updating workflow stats...');
        this.updateWorkflowStats();
        console.log('✅ Workflow initialization complete');
        
        // Update authentication UI
        this.updateAuthUI();
        
        // Always load sidebar categories (public access) - AFTER notes are loaded
        updateSidebarCategories();
        
        if (this.isAuthenticated) {
            // Add sample data if no notes exist
            if (this.notes.length === 0) {
                this.addSampleData();
            }
        }
        
        this.showPersonalSection(); // Start with personal website (no login required)
    }

    async addSampleData() {
        const sampleNotes = [
            {
                title: "Welcome to KnowledgeHub",
                category: "ideas",
                content: "This is your personal knowledge management system. You can organize your thoughts, ideas, projects, and learning resources all in one place. Start by adding your first note!",
                tags: ["welcome", "getting-started"]
            },
            {
                title: "JavaScript Tips",
                category: "learning",
                content: "Remember to use const and let instead of var. Arrow functions are great for callbacks. Always handle async operations with try-catch blocks.",
                tags: ["javascript", "tips", "best-practices"]
            }
        ];
        
        try {
            for (const noteData of sampleNotes) {
                const response = await this.apiRequest('/notes', 'POST', noteData);
                if (response.success) {
                    this.notes.unshift(response.data.note);
                }
            }
            
            this.updateAllTags();
            this.renderNotes();
            this.updateCategoryCounts();
            this.updateTagFilters();
            this.updateKnowledgeStats();
        } catch (error) {
            console.error('Failed to add sample data:', error);
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.applyFilters();
        });

        // Personal section navigation is handled by showSection function

        // Note form submission
        const noteForm = document.getElementById('noteForm');
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveNote();
        });

        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                
                const result = await this.login(email, password);
                if (!result.success) {
                    alert(result.message);
                }
            });
        }

        // Register form submission
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            const result = await this.register(name, email, password, confirmPassword);
            if (!result.success) {
                alert(result.message);
            }
            });
        }

        // Close modal when clicking outside
        const modal = document.getElementById('noteModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    searchNotes(query) {
        const filteredNotes = this.notes.filter(note => {
            const matchesQuery = !query || 
                note.title.toLowerCase().includes(query.toLowerCase()) ||
                note.content.toLowerCase().includes(query.toLowerCase()) ||
                note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
            
            const matchesCategory = this.currentFilter === 'all' || note.category === this.currentFilter;
            
            return matchesQuery && matchesCategory;
        });

        this.renderNotes(filteredNotes);
    }


    renderNotes(notesToRender = null) {
        const notes = notesToRender || this.notes;
        const notesGrid = document.getElementById('notesGrid');
        
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #666;">
                    <i class="fas fa-sticky-note" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No notes found</h3>
                    <p>Start building your knowledge base by adding your first note!</p>
                </div>
            `;
            return;
        }

        const isGuest = this.currentUser && this.currentUser.isGuest;
        const isAuthenticated = this.isAuthenticated;
        const canCreateNotes = isAuthenticated && this.currentUser && (this.currentUser.can_create_notes || this.currentUser.role === 'admin') && !isGuest;
        
        notesGrid.innerHTML = notes.map(note => {
            let clickAction = `onclick="showNoteDetail('${note.id}')"`;
            let statusMessage = '';
            let showActions = false;
            
            // Always show note details on click, but control edit actions separately
            if (canCreateNotes && !note.isGuest) {
                showActions = true;
            } else if (!isAuthenticated) {
                statusMessage = '<div class="permission-notice" style="text-align: center; color: #888; font-size: 0.8em; margin-top: 8px;"><i class="fas fa-eye"></i> Click to view details</div>';
            } else if (isGuest) {
                statusMessage = '<div class="permission-notice" style="text-align: center; color: #888; font-size: 0.8em; margin-top: 8px;"><i class="fas fa-eye"></i> View Only (Guest)</div>';
            } else {
                statusMessage = '<div class="permission-notice" style="text-align: center; color: #888; font-size: 0.8em; margin-top: 8px;"><i class="fas fa-eye"></i> View Only (No Edit Permission)</div>';
            }
            
            return `
            <div class="note-card" ${clickAction}>
                <div class="note-header">
                    <div>
                        <div class="note-title">${this.escapeHtml(note.title)}</div>
                        <div class="note-date">${this.formatDate(note.updated_at || note.updatedAt)}</div>
                    </div>
                    ${showActions && !note.isGuest ? `
                    <div class="note-actions">
                        <button onclick="event.stopPropagation(); duplicateNote('${note.id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="note-content">
                    ${this.escapeHtml(note.content.substring(0, 150))}${note.content.length > 150 ? '...' : ''}
                </div>
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag clickable" onclick="toggleTagFilter('${tag.toLowerCase()}')" title="Filter by ${tag}">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
                ${statusMessage}
            </div>
        `}).join('');
    }

    async openModal() {
        if (!this.isAuthenticated) {
            this.showLoginForAction('create notes');
            return;
        }
        
        if (this.currentUser && this.currentUser.isGuest) {
            alert('Guest users can only view notes. Please sign up for a free account to create and manage notes.');
            return;
        }
        
        if (this.currentUser && !this.currentUser.can_create_notes && this.currentUser.role !== 'admin') {
            alert('You do not have permission to create notes. Contact your administrator for access.');
            return;
        }
        
        this.editingNoteId = null;
        document.getElementById('modalTitle').textContent = 'Add New Note';
        document.getElementById('noteForm').reset();
        document.getElementById('noteModal').classList.add('active');
        document.getElementById('noteTitle').focus();
        
        // Load categories for the dropdown
        await loadCategoriesForNoteForm();
    }

    async openEditModal(noteId) {
        if (!this.isAuthenticated) {
            this.showLoginForAction('edit notes');
            return;
        }
        
        if (this.currentUser && this.currentUser.isGuest) {
            alert('Guest users can only view notes. Please sign up for a free account to edit notes.');
            return;
        }

        if (this.currentUser && !this.currentUser.can_create_notes && this.currentUser.role !== 'admin') {
            alert('You do not have permission to edit notes. Contact your administrator for access.');
            return;
        }

        const note = this.notes.find(n => n.id == noteId);
        if (!note) return;

        this.editingNoteId = noteId;
        document.getElementById('modalTitle').textContent = 'Edit Note';
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        document.getElementById('noteTags').value = note.tags.join(', ');
        document.getElementById('noteModal').classList.add('active');
        document.getElementById('noteTitle').focus();
        
        // Load categories for the dropdown, then set the selected value
        await loadCategoriesForNoteForm();
        document.getElementById('noteCategory').value = note.category;
    }

    closeModal() {
        document.getElementById('noteModal').classList.remove('active');
        this.editingNoteId = null;
    }


    updateCategoryCounts() {
        const counts = {
            all: this.notes.length,
            ideas: this.notes.filter(n => n.category === 'ideas').length,
            projects: this.notes.filter(n => n.category === 'projects').length,
            learning: this.notes.filter(n => n.category === 'learning').length,
            resources: this.notes.filter(n => n.category === 'resources').length
        };

        document.querySelectorAll('.category-item').forEach(item => {
            const category = item.dataset.category;
            const countElement = item.querySelector('.count');
            if (countElement && counts[category] !== undefined) {
                countElement.textContent = counts[category];
            }
        });
    }


    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    processContentForDisplay(content) {
        // First escape HTML to prevent XSS
        let processedContent = this.escapeHtml(content);
        
        // Convert URLs to clickable links
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
        processedContent = processedContent.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3498db; text-decoration: underline;">${url}</a>`;
        });
        
        // Convert line breaks to HTML breaks
        processedContent = processedContent.replace(/\n/g, '<br>');
        
        return processedContent;
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Personal website navigation methods
    showPersonalSection() {
        this.currentSection = 'personal';
        
        // Hide all content sections first
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show personal content
        document.getElementById('personalContent').classList.remove('hidden');
        
        // Show personal navigation, hide others
        document.getElementById('personalSection').classList.remove('hidden');
        document.getElementById('knowledgeSection').classList.add('hidden');
        
        // Hide KnowledgeHub navigation
        this.hideKnowledgeNav();
        
        // Update header
        document.getElementById('mainHeader').innerHTML = `
            <h2>Welcome to My Digital Space</h2>
            <p>AI-Powered Engineer • Prototype Builder • Claude Code Explorer</p>
        `;
        
        // Show the current personal page
        this.showPersonalPage(this.currentPersonalPage);
    }

    async showKnowledgeSection(category = 'all') {
        this.currentSection = 'knowledge';
        document.getElementById('personalContent').classList.add('hidden');
        document.getElementById('knowledgeContent').classList.remove('hidden');
        document.getElementById('personalSection').classList.add('hidden');
        document.getElementById('knowledgeSection').classList.remove('hidden');
        
        // Update header
        document.getElementById('mainHeader').innerHTML = `
            <h2>Knowledge Management</h2>
            <p>Organize and manage your ideas, projects, and learnings</p>
        `;
        
        // Load sidebar categories when entering knowledge section (available to everyone)
        // Ensure notes are loaded first, then update categories
        await this.loadUserNotes();
        this.renderNotes();
        this.updateCategoryCounts();
        updateSidebarCategories();
        
        // Filter by the specified category (after all data is loaded)
        this.filterByCategory(category);
        
        // Always show knowledge content and navigation, regardless of authentication
        this.showKnowledgeNav();
        
        // Update UI based on authentication status
        this.updateGuestUI();
        this.updateKnowledgeNav();
        
        // Update tag filters (notes and category counts already updated above)
        this.updateTagFilters();
    }

    showPersonalPage(pageId) {
        this.currentPersonalPage = pageId;
        
        // Handle special sections
        if (pageId === 'knowledgehub') {
            this.showKnowledgeSection('all');
            return;
        }
        
        if (pageId === 'workflowhub') {
            this.showWorkflowSection();
            return;
        }
        
        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show personal content
        document.getElementById('personalContent').classList.remove('hidden');
        
        // Hide all personal cards
        document.querySelectorAll('.personal-card').forEach(card => {
            card.classList.add('hidden');
        });
        
        // Show selected card
        document.getElementById(`${pageId}-content`).classList.remove('hidden');
        
        // Update active navigation
        document.querySelectorAll('#personalSection .category-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.querySelector(`[data-section="${pageId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Update main header
        const header = document.getElementById('mainHeader');
        const titles = {
            'home': { title: 'Welcome to My Digital Space', subtitle: 'Software Developer, Problem Solver & Lifelong Learner' },
            'about': { title: 'About Me', subtitle: 'Technology leader with 20+ years of experience' },
            'projects': { title: 'Featured Projects', subtitle: 'Showcasing innovation and technical expertise' },
            'contact': { title: 'Get In Touch', subtitle: 'Let\'s connect and discuss opportunities' }
        };
        
        const pageInfo = titles[pageId] || titles['home'];
        header.innerHTML = `
            <h2>${pageInfo.title}</h2>
            <p>${pageInfo.subtitle}</p>
        `;
    }

    filterByCategory(category) {
        this.currentFilter = category;
        const searchQuery = document.getElementById('searchInput').value;
        
        // Update active category
        document.querySelectorAll('#knowledgeSection .category-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Update header
        const headerTitle = category === 'all' ? 'All Notes' : 
            category.charAt(0).toUpperCase() + category.slice(1);
        document.getElementById('mainHeader').innerHTML = `
            <h2>${headerTitle}</h2>
            <p>Manage and organize your knowledge effectively</p>
        `;
        
        if (searchQuery) {
            this.searchNotes(searchQuery);
        } else {
            const filteredNotes = category === 'all' ? this.notes : 
                this.notes.filter(note => note.category === category);
            this.renderNotes(filteredNotes);
        }
        
        // Update breadcrumb
        this.updateBreadcrumb();
    }

    // Enhanced search and tagging methods
    updateAllTags() {
        this.allTags.clear();
        this.notes.forEach(note => {
            note.tags.forEach(tag => this.allTags.add(tag.toLowerCase()));
        });
    }

    updateTagFilters() {
        const filtersContainer = document.getElementById('searchFilters');
        if (!filtersContainer) return;
        
        const tags = Array.from(this.allTags).slice(0, 10); // Show top 10 tags
        filtersContainer.innerHTML = tags.map(tag => `
            <span class="filter-tag ${this.activeTagFilters.includes(tag) ? 'active' : ''}" 
                  onclick="toggleTagFilter('${tag}')">
                ${tag}
            </span>
        `).join('');
    }

    toggleTagFilter(tag) {
        if (this.activeTagFilters.includes(tag)) {
            this.activeTagFilters = this.activeTagFilters.filter(t => t !== tag);
        } else {
            this.activeTagFilters.push(tag);
        }
        
        this.updateTagFilters();
        this.applyFilters();
    }

    applyFilters() {
        let filteredNotes = this.notes;
        
        // Apply category filter
        if (this.currentFilter !== 'all') {
            filteredNotes = filteredNotes.filter(note => note.category === this.currentFilter);
        }
        
        // Apply tag filters
        if (this.activeTagFilters.length > 0) {
            filteredNotes = filteredNotes.filter(note => 
                this.activeTagFilters.some(tag => 
                    note.tags.some(noteTag => noteTag.toLowerCase() === tag)
                )
            );
        }
        
        // Apply search query
        const searchQuery = document.getElementById('searchInput')?.value || '';
        if (searchQuery) {
            filteredNotes = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        
        this.renderNotes(filteredNotes);
        this.updateBreadcrumb();
    }

    updateKnowledgeStats() {
        // Update stats in the personal KnowledgeHub section
        const totalNotesEl = document.getElementById('totalNotes');
        const totalTagsEl = document.getElementById('totalTags');
        const lastUpdatedEl = document.getElementById('lastUpdated');
        
        if (totalNotesEl) totalNotesEl.textContent = this.notes.length;
        if (totalTagsEl) totalTagsEl.textContent = this.allTags.size;
        if (lastUpdatedEl && this.notes.length > 0) {
            const lastNote = this.notes.reduce((latest, note) => 
                new Date(note.updatedAt) > new Date(latest.updatedAt) ? note : latest
            );
            lastUpdatedEl.textContent = this.formatDate(lastNote.updatedAt);
        }
    }

    // Enhanced CRUD operations
    async saveNote() {
        if (!this.isAuthenticated) {
            alert('Please log in to save notes');
            return;
        }

        const title = document.getElementById('noteTitle').value.trim();
        const category = document.getElementById('noteCategory').value;
        const content = document.getElementById('noteContent').value.trim();
        const tagsInput = document.getElementById('noteTags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        console.log('Save note data:', { title, category, content, tags });

        if (!title || !content || !category) {
            alert('Please fill in all required fields (title, category, and content)');
            return;
        }

        try {
            if (this.editingNoteId) {
                // Update existing note
                const response = await this.apiRequest(`/notes/${this.editingNoteId}`, 'PUT', {
                    title,
                    category,
                    content,
                    tags
                });
                
                if (response.success) {
                    const noteIndex = this.notes.findIndex(n => n.id == this.editingNoteId);
                    if (noteIndex !== -1) {
                        this.notes[noteIndex] = response.data.note;
                    }
                    this.showNotification('Note updated successfully!');
                } else {
                    console.error('Update note failed:', response);
                    if (response.code === 'INSUFFICIENT_PERMISSIONS') {
                        alert('You do not have permission to edit notes. Contact your administrator for access.');
                    } else {
                        alert(response.message || 'Failed to update note');
                    }
                    return;
                }
            } else {
                // Create new note
                const response = await this.apiRequest('/notes', 'POST', {
                    title,
                    category,
                    content,
                    tags
                });
                
                if (response.success) {
                    this.notes.unshift(response.data.note);
                    this.showNotification('Note created successfully!');
                } else {
                    console.error('Create note failed:', response);
                    if (response.code === 'INSUFFICIENT_PERMISSIONS') {
                        alert('You do not have permission to create notes. Contact your administrator for access.');
                    } else {
                        alert(response.message || 'Failed to create note');
                    }
                    return;
                }
            }

            this.updateAllTags();
            this.renderNotes();
            this.updateCategoryCounts();
            this.updateTagFilters();
            this.updateKnowledgeStats();
            this.closeModal();
        } catch (error) {
            console.error('Save note error:', error);
            alert('Failed to save note. Please try again.');
        }
    }

    async deleteNote(noteId) {
        if (!this.isAuthenticated) {
            this.showLoginForAction('delete notes');
            return;
        }

        if (this.currentUser && this.currentUser.isGuest) {
            alert('Guest users can only view notes. Please sign up for a free account to delete notes.');
            return;
        }

        if (this.currentUser && !this.currentUser.can_create_notes && this.currentUser.role !== 'admin') {
            alert('You do not have permission to delete notes. Contact your administrator for access.');
            return;
        }

        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            const response = await this.apiRequest(`/notes/${noteId}`, 'DELETE');
            
            if (response.success) {
                this.notes = this.notes.filter(n => n.id != noteId);
                this.updateAllTags();
                this.renderNotes();
                this.updateCategoryCounts();
                this.updateTagFilters();
                this.updateKnowledgeStats();
                this.showNotification('Note deleted successfully!');
            } else {
                if (response.code === 'INSUFFICIENT_PERMISSIONS') {
                    alert('You do not have permission to delete notes. Contact your administrator for access.');
                } else {
                    alert(response.message || 'Failed to delete note');
                }
            }
        } catch (error) {
            console.error('Delete note error:', error);
            alert('Failed to delete note. Please try again.');
        }
    }

    async duplicateNote(noteId) {
        if (!this.isAuthenticated) {
            alert('Please log in to duplicate notes');
            return;
        }

        if (this.currentUser && this.currentUser.isGuest) {
            alert('Guest users can only view notes. Please sign up for a free account to duplicate notes.');
            return;
        }

        if (this.currentUser && !this.currentUser.can_create_notes && this.currentUser.role !== 'admin') {
            alert('You do not have permission to duplicate notes. Contact your administrator for access.');
            return;
        }

        const note = this.notes.find(n => n.id == noteId);
        if (!note) return;

        try {
            const response = await this.apiRequest('/notes', 'POST', {
                title: `${note.title} (Copy)`,
                category: note.category,
                content: note.content,
                tags: note.tags
            });

            if (response.success) {
                this.notes.unshift(response.data.note);
                this.updateAllTags();
                this.renderNotes();
                this.updateCategoryCounts();
                this.updateTagFilters();
                this.updateKnowledgeStats();
                this.showNotification('Note duplicated successfully!');
            } else {
                if (response.code === 'INSUFFICIENT_PERMISSIONS') {
                    alert('You do not have permission to duplicate notes. Contact your administrator for access.');
                } else {
                    alert(response.message || 'Failed to duplicate note');
                }
            }
        } catch (error) {
            console.error('Duplicate note error:', error);
            alert('Failed to duplicate note. Please try again.');
        }
    }

    // Import/Export functionality
    exportNotes() {
        // Check if user has admin privileges
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            alert('Export functionality is restricted to administrators only. Contact your administrator for access.');
            return;
        }

        const dataStr = JSON.stringify(this.notes, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `knowledgehub-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Notes exported successfully!');
    }

    importNotes() {
        // Check if user has admin privileges
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            alert('Import functionality is restricted to administrators only. Contact your administrator for access.');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedNotes = JSON.parse(event.target.result);
                    if (Array.isArray(importedNotes)) {
                        // Add imported notes with new IDs to avoid conflicts
                        const newNotes = importedNotes.map(note => ({
                            ...note,
                            id: Date.now() + Math.random(),
                            importedAt: new Date().toISOString()
                        }));
                        
                        this.notes = [...newNotes, ...this.notes];
                        this.updateAllTags();
                        this.renderNotes();
                        this.updateCategoryCounts();
                        this.updateTagFilters();
                        this.updateKnowledgeStats();
                        this.showNotification(`Imported ${newNotes.length} notes successfully!`);
                    } else {
                        throw new Error('Invalid file format');
                    }
                } catch (error) {
                    alert('Error importing notes: Invalid file format');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // Authentication System - API Integration
    async checkAuthStatus() {
        if (!this.authToken) {
            this.isAuthenticated = false;
            return;
        }

        try {
            const response = await this.apiRequest('/auth/profile', 'GET');
            if (response.success) {
                this.currentUser = response.data.user;
                this.isAuthenticated = true;
                this.showUserInfo();
                await this.loadUserNotes();
            } else {
                this.logout(false); // Silent logout
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout(false);
        }
    }

    async loadUserNotes() {
        try {
            // Public endpoint - no auth required for reading notes
            const response = await fetch(`${this.apiBaseUrl}/notes`);
            const result = await response.json();
            
            if (result.success) {
                this.notes = result.data.notes;
                return this.notes;
            } else {
                console.error('Failed to load notes:', result.message);
                this.notes = [];
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.notes = [];
        }
        return [];
    }

    loadSampleDataForGuests() {
        // Provide sample notes for guest users to view
        this.notes = [
            {
                id: 'sample-1',
                title: "Welcome to KnowledgeHub",
                category: "ideas",
                content: "This is a demonstration of the knowledge management system. You can browse through different categories and see how notes are organized. Sign in to create your own notes and manage your personal knowledge base.",
                tags: ["welcome", "demo"],
                created_at: "2024-01-15T10:30:00Z",
                updated_at: "2024-01-15T10:30:00Z",
                isGuest: true
            },
            {
                id: 'sample-2',
                title: "Technology Stack Overview",
                category: "learning",
                content: "This application is built with modern web technologies including vanilla JavaScript, CSS3, Node.js backend, and SQLite database. The architecture focuses on simplicity and performance.",
                tags: ["technology", "web-development", "javascript"],
                created_at: "2024-01-14T15:45:00Z",
                updated_at: "2024-01-14T15:45:00Z",
                isGuest: true
            },
            {
                id: 'sample-3',
                title: "Project Planning Methods",
                category: "projects",
                content: "Effective project planning involves breaking down complex tasks into manageable components, setting clear timelines, and maintaining regular communication with stakeholders.",
                tags: ["project-management", "planning", "productivity"],
                created_at: "2024-01-13T09:20:00Z",
                updated_at: "2024-01-13T09:20:00Z",
                isGuest: true
            },
            {
                id: 'sample-4',
                title: "Learning Resources Collection",
                category: "resources",
                content: "Curated collection of valuable learning resources including online courses, documentation, books, and tutorials for continuous professional development.",
                tags: ["learning", "resources", "education"],
                created_at: "2024-01-12T14:10:00Z",
                updated_at: "2024-01-12T14:10:00Z",
                isGuest: true
            },
            {
                id: 'sample-5',
                title: "AI and Machine Learning Trends",
                category: "ideas",
                content: "Exploring current trends in artificial intelligence and machine learning, including large language models, computer vision, and their practical applications in various industries.",
                tags: ["AI", "machine-learning", "trends", "innovation"],
                created_at: "2024-01-11T11:30:00Z",
                updated_at: "2024-01-11T11:30:00Z",
                isGuest: true
            }
        ];
    }

    // API Request Helper
    async apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        // Add auth token if available
        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
            console.log('🔑 Auth token added to request');
        } else {
            console.log('⚠️ No auth token available');
        }

        // Add request body for POST/PUT requests
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        console.log('API Request:', method, url, data);
        
        try {
            const response = await fetch(url, options);
            console.log('API Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error:', errorData);
                return { success: false, message: errorData.message || `HTTP ${response.status}` };
            }

            const responseData = await response.json();
            console.log('API Response data:', responseData);
            return responseData;
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            return { success: false, message: 'Network error: ' + fetchError.message };
        }
    }

    showLoginScreen() {
        if (this.currentSection === 'knowledge') {
            // Show lock overlay for KnowledgeHub
            this.showKnowledgeLock();
        } else {
            // Show quick login modal instead
            showQuickLogin();
        }
    }

    showKnowledgeLock() {
        const knowledgeContent = document.getElementById('knowledgeContent');
        knowledgeContent.classList.add('protected-content');
        
        // Remove any existing lock message first
        const existingLockMessage = document.getElementById('lockMessage');
        if (existingLockMessage) {
            existingLockMessage.remove();
        }
        
        // Add lock message
        const lockMessage = document.createElement('div');
        lockMessage.className = 'lock-message';
        lockMessage.id = 'lockMessage';
        lockMessage.innerHTML = `
            <i class="fas fa-lock"></i>
            <h3>KnowledgeHub is Protected</h3>
            <p>Please sign in to access your personal knowledge base</p>
            <button class="login-btn" onclick="showFullLogin()">
                <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
        `;
        knowledgeContent.style.position = 'relative';
        knowledgeContent.appendChild(lockMessage);
    }

    hideKnowledgeLock() {
        const knowledgeContent = document.getElementById('knowledgeContent');
        const lockMessage = document.getElementById('lockMessage');
        
        knowledgeContent.classList.remove('protected-content');
        if (lockMessage) {
            lockMessage.remove();
        }
    }

    showFullLogin() {
        // Use the quick login modal instead
        showQuickLogin();
    }

    showLoginForAction(action) {
        // Show a contextual login prompt
        const loginMessage = document.querySelector('.login-header p');
        if (loginMessage) {
            loginMessage.textContent = `Please sign in to ${action}`;
        }
        this.showFullLogin();
    }

    hideLogin() {
        // Close the quick login modal instead
        closeQuickLogin();
    }

    showNoteDetail(noteId) {
        const note = this.notes.find(n => n.id == noteId);
        if (!note) return;

        // Populate the detail modal with note data
        document.getElementById('detailTitle').textContent = note.title;
        document.getElementById('detailCategory').textContent = note.category;
        document.getElementById('detailDate').textContent = this.formatDate(note.updated_at || note.updatedAt);
        document.getElementById('detailContent').innerHTML = this.processContentForDisplay(note.content);
        
        // Handle tags
        const tagsContainer = document.getElementById('detailTags');
        if (note.tags && note.tags.length > 0) {
            tagsContainer.innerHTML = note.tags.map(tag => 
                `<span class="tag">${this.escapeHtml(tag)}</span>`
            ).join('');
        } else {
            tagsContainer.innerHTML = '';
        }

        // Show/hide edit button based on permissions
        const editBtn = document.getElementById('editNoteBtn');
        const canEdit = this.isAuthenticated && 
                       this.currentUser && 
                       (this.currentUser.can_create_notes || this.currentUser.role === 'admin') && 
                       !this.currentUser.isGuest &&
                       !note.isGuest;
        
        if (canEdit) {
            editBtn.style.display = 'inline-block';
            editBtn.setAttribute('data-note-id', noteId);
        } else {
            editBtn.style.display = 'none';
        }

        // Show the modal
        document.getElementById('noteDetailModal').classList.add('active');
    }

    closeNoteDetail() {
        document.getElementById('noteDetailModal').classList.remove('active');
    }

    editFromDetail() {
        const editBtn = document.getElementById('editNoteBtn');
        const noteId = editBtn.getAttribute('data-note-id');
        this.closeNoteDetail();
        this.openEditModal(noteId);
    }

    showUserInfo() {
        if (!this.currentUser) return;
        
        const userInfo = document.getElementById('userInfo');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        userInfo.classList.remove('hidden');
        userAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
        userName.textContent = this.currentUser.name;
    }

    hideUserInfo() {
        document.getElementById('userInfo').classList.add('hidden');
    }

    switchLoginTab(tab) {
        // No longer needed - only using quick login modal
        console.log('switchLoginTab is deprecated, using quick login modal instead');
    }

    async login(email, password) {
        console.log('Login method called with email:', email);
        try {
            const response = await this.apiRequest('/auth/login', 'POST', {
                email,
                password
            });
            console.log('API response:', response);
            
            if (response.success) {
                this.authToken = response.data.token;
                this.currentUser = response.data.user;
                this.isAuthenticated = true;
                
                console.log('Setting auth token and user:', this.currentUser);
                localStorage.setItem('knowledgehub_auth_token', this.authToken);
                
                // Load user's notes
                await this.loadUserNotes();
                
                try { this.hideLogin(); } catch(e) { console.error('hideLogin error:', e); }
                try { this.hideKnowledgeLock(); } catch(e) { console.error('hideKnowledgeLock error:', e); }
                try { this.showUserInfo(); } catch(e) { console.error('showUserInfo error:', e); }
                try { this.updateGuestUI(); } catch(e) { console.error('updateGuestUI error:', e); }
                try { this.updateAllTags(); } catch(e) { console.error('updateAllTags error:', e); }
                try { this.renderNotes(); } catch(e) { console.error('renderNotes error:', e); }
                try { this.updateCategoryCounts(); } catch(e) { console.error('updateCategoryCounts error:', e); }
                try { this.updateTagFilters(); } catch(e) { console.error('updateTagFilters error:', e); }
                try { this.updateKnowledgeStats(); } catch(e) { console.error('updateKnowledgeStats error:', e); }
                
                // Add sample data if no notes exist
                if (this.notes.length === 0) {
                    this.addSampleData();
                }
                
                this.showNotification(`Welcome back, ${response.data.user.name}!`);
                return { success: true };
            } else {
                return { success: false, message: response.message || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }

    async register(name, email, password, confirmPassword) {
        if (password !== confirmPassword) {
            return { success: false, message: 'Passwords do not match' };
        }
        
        if (password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters' };
        }
        
        try {
            const response = await this.apiRequest('/auth/register', 'POST', {
                name: name.trim(),
                email: email.toLowerCase(),
                password,
                confirmPassword
            });
            
            if (response.success) {
                this.authToken = response.data.token;
                this.currentUser = response.data.user;
                this.isAuthenticated = true;
                
                localStorage.setItem('knowledgehub_auth_token', this.authToken);
                
                // Load user's notes
                await this.loadUserNotes();
                
                this.hideLogin();
                this.hideKnowledgeLock();
                this.showUserInfo();
                this.updateGuestUI();
                this.updateAllTags();
                this.renderNotes();
                this.updateCategoryCounts();
                this.updateTagFilters();
                this.updateKnowledgeStats();
                
                this.showNotification(`Welcome, ${response.data.user.name}!`);
                return { success: true };
            } else {
                return { success: false, message: response.message || 'Registration failed' };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Registration failed. Please try again.' };
        }
    }

    logout(showMessage = true) {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authToken = null;
        this.activeTagFilters = [];
        this.allTags.clear();
        
        localStorage.removeItem('knowledgehub_auth_token');
        localStorage.removeItem('knowledgehub_current_user');
        localStorage.removeItem('knowledgehub_session_expiry');
        
        // Update the new authentication UI
        this.updateAuthUI();
        
        // Load public notes after logout
        this.loadUserNotes();
        
        // Navigate back to home page after logout
        this.showPersonalSection();
        this.showPersonalPage('home');
        
        if (showMessage) {
            this.showNotification('Logged out successfully - all notes remain visible!');
        }
    }

    continueAsGuest() {
        const guestUser = {
            id: 'guest',
            name: 'Guest User',
            email: 'guest@localhost',
            isGuest: true
        };
        
        this.currentUser = guestUser;
        this.isAuthenticated = true;
        
        // Load sample notes for guests to view
        this.notes = [
            {
                id: 1,
                title: "Welcome to KnowledgeHub",
                category: "ideas",
                content: "This is a sample note to demonstrate the KnowledgeHub interface. As a guest, you can view notes and explore the features, but you'll need to sign up for a free account to create, edit, or manage your own notes.",
                tags: ["welcome", "demo", "sample"],
                createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                updatedAt: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 2,
                title: "JavaScript Best Practices",
                category: "learning", 
                content: "Here are some key JavaScript best practices:\n\n1. Use const and let instead of var\n2. Always use === for comparisons\n3. Handle errors with try-catch blocks\n4. Use arrow functions for callbacks\n5. Avoid global variables\n\nThis is a sample note showing how you can organize your learning materials in KnowledgeHub.",
                tags: ["javascript", "programming", "best-practices", "sample"],
                createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                updatedAt: new Date(Date.now() - 172800000).toISOString()
            },
            {
                id: 3,
                title: "Project Ideas",
                category: "projects",
                content: "Some project ideas I'm considering:\n\n• Build a personal portfolio website\n• Create a task management app\n• Develop a weather dashboard\n• Make a recipe organizer\n\nThis is a sample project note. Sign up to create your own project notes and track your ideas!",
                tags: ["projects", "ideas", "portfolio", "sample"],
                createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
                updatedAt: new Date(Date.now() - 259200000).toISOString()
            }
        ];
        
        this.hideLogin();
        this.hideKnowledgeLock();
        this.showUserInfo();
        this.updateGuestUI();
        this.updateAllTags();
        this.renderNotes();
        this.updateCategoryCounts();
        this.updateTagFilters();
        this.updateKnowledgeStats();
        
        this.showNotification('Viewing as guest - Sign up to create and manage your own notes!');
    }

    hashPassword(password) {
        // Simple hash function for demo purposes
        // In production, use proper bcrypt or similar
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }


    updateGuestUI() {
        const isGuest = this.currentUser && this.currentUser.isGuest;
        const isAuthenticated = this.isAuthenticated;
        const canCreateNotes = isAuthenticated && this.currentUser && (this.currentUser.can_create_notes || this.currentUser.role === 'admin') && !isGuest;
        const isAdmin = isAuthenticated && this.currentUser && this.currentUser.role === 'admin' && !isGuest;
        
        // For unauthenticated users, show add note buttons but they'll trigger login
        const addNoteButtons = document.querySelectorAll('button[onclick="openModal()"]');
        addNoteButtons.forEach(btn => {
            if (!isAuthenticated) {
                // Show button for guests, but it will prompt for login
                btn.style.display = '';
                btn.innerHTML = '<i class="fas fa-lock"></i> Sign in to Manage Note';
                btn.classList.add('login-required');
            } else if (!canCreateNotes) {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
                btn.innerHTML = '<i class="fas fa-plus"></i> Add Note';
                btn.classList.remove('login-required');
            }
        });
        
        // Hide/show export/import buttons for admin only
        const exportBtn = document.querySelector('button[onclick="exportNotes()"]');
        const importBtn = document.querySelector('button[onclick="importNotes()"]');
        
        if (exportBtn) {
            if (!isAdmin) {
                exportBtn.style.display = 'none';
            } else {
                exportBtn.style.display = '';
                exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Notes';
            }
        }
        
        if (importBtn) {
            if (!isAdmin) {
                importBtn.style.display = 'none';
            } else {
                importBtn.style.display = '';
            }
        }
        
        // Hide/show Manage Categories button for admin only
        const manageCategoriesBtn = document.querySelector('button[onclick="showCategoryManagement()"]');
        if (manageCategoriesBtn) {
            if (!isAdmin) {
                manageCategoriesBtn.style.display = 'none';
            } else {
                manageCategoriesBtn.style.display = '';
                manageCategoriesBtn.innerHTML = '<i class="fas fa-tags"></i> Manage Categories';
            }
        }
    }

    // Navigation Bar Methods
    showKnowledgeNav() {
        const knowledgeNav = document.getElementById('knowledgeNav');
        if (knowledgeNav) {
            knowledgeNav.classList.add('visible');
        }
    }

    hideKnowledgeNav() {
        const knowledgeNav = document.getElementById('knowledgeNav');
        if (knowledgeNav) {
            knowledgeNav.classList.remove('visible');
        }
    }

    updateKnowledgeNav() {
        if (!this.currentUser) return;
        
        // Update user info in nav
        const navUserAvatar = document.getElementById('navUserAvatar');
        const navUserName = document.getElementById('navUserName');
        
        if (navUserAvatar) {
            navUserAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
        }
        
        if (navUserName) {
            navUserName.textContent = this.currentUser.name;
        }
        
        // Update breadcrumb based on current filter
        this.updateBreadcrumb();
    }

    updateBreadcrumb() {
        const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
        if (!breadcrumbCurrent) return;
        
        let breadcrumbText = 'KnowledgeHub';
        
        if (this.currentFilter !== 'all') {
            breadcrumbText = this.currentFilter.charAt(0).toUpperCase() + this.currentFilter.slice(1);
        }
        
        if (this.activeTagFilters.length > 0) {
            breadcrumbText += ` • ${this.activeTagFilters.join(', ')}`;
        }
        
        breadcrumbCurrent.textContent = breadcrumbText;
    }

    goToHomepage() {
        // Navigate back to personal website
        console.log('Going to homepage...');
        
        // Reset current section and page state FIRST
        this.currentSection = 'personal';
        this.currentPersonalPage = 'home';
        
        // Force show personal section first
        this.showPersonalSection();
        
        // Ensure navigation states are correct
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Don't set any navigation item as active for home
        console.log('Homepage navigation complete');
    }

    toggleMobileNav() {
        const navRight = document.getElementById('navRight');
        if (navRight) {
            navRight.style.display = navRight.style.display === 'none' ? 'flex' : 'none';
        }
    }
    
    // Admin setup function - run in browser console with: window.personalWebsite.setupAdminUser()
    setupAdminUser(name = 'Davis Zhang', email = 'davis.zhangxi@outlook.com') {
        const adminUser = {
            id: 'admin-1',
            name: name,
            email: email,
            isGuest: false,
            role: 'admin',
            can_create_notes: true
        };
        
        this.isAuthenticated = true;
        this.currentUser = adminUser;
        
        // Store admin session
        localStorage.removeItem('knowledgehub_guest_session');
        localStorage.setItem('knowledgehub_user_data', JSON.stringify(adminUser));
        localStorage.setItem('knowledgehub_auth_token', 'admin-token-local');
        
        // Close any login modal if visible
        closeQuickLogin();
        
        // Update UI
        this.updateGuestUI();
        this.updateAllTags();
        this.renderNotes();
        this.updateCategoryCounts();
        this.updateTagFilters();
        this.updateKnowledgeStats();
        
        console.log('Admin user setup complete! You now have full access to all features.');
        this.showNotification('Admin access granted! You now have full access to all features.');
        
        return adminUser;
    }

    // Update authentication UI
    updateAuthUI() {
        console.log('=== UPDATE AUTH UI DEBUG ===');
        console.log('isAuthenticated:', this.isAuthenticated);
        console.log('currentUser:', this.currentUser);
        
        const authLogin = document.getElementById('authLogin');
        const adminActions = document.getElementById('adminActions');
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        const authNote = document.getElementById('authNote');
        
        console.log('UI Elements found:', {
            authLogin: !!authLogin,
            adminActions: !!adminActions,
            adminLoginBtn: !!adminLoginBtn,
            authNote: !!authNote
        });
        
        if (this.isAuthenticated && this.currentUser) {
            console.log('AUTHENTICATED BRANCH: Updating UI for logged in user');
            
            // Update button to logout
            if (adminLoginBtn) {
                console.log('Updating login button to logout');
                adminLoginBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                adminLoginBtn.onclick = () => this.logout();
            }
            if (authNote) {
                console.log('Updating auth note text');
                authNote.textContent = `Logged in as ${this.currentUser.name} (${this.currentUser.role})`;
            }
            
            // Show admin actions if user has admin privileges
            if (adminActions) {
                if (this.currentUser.role === 'admin' || this.currentUser.can_create_notes) {
                    console.log('Showing admin actions for admin user');
                    adminActions.classList.remove('hidden');
                } else {
                    console.log('Hiding admin actions for non-admin user');
                    adminActions.classList.add('hidden');
                }
            }
        } else {
            // Update button to login
            if (adminLoginBtn) {
                adminLoginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                adminLoginBtn.onclick = showQuickLogin;
            }
            if (authNote) {
                authNote.textContent = 'Login to manage notes & categories';
            }
            
            // Ensure admin actions are hidden when not authenticated
            if (adminActions) {
                adminActions.classList.add('hidden');
            }
        }
        
        // Always keep the Admin Access section visible
        if (authLogin) {
            authLogin.classList.remove('hidden');
        }
    }

    // Workflow Management Methods
    async loadWorkflows() {
        try {
            console.log('🔄 Loading workflows...');
            const response = await this.apiRequest('/workflows', 'GET');
            console.log('📥 Workflows response:', response);
            console.log('📊 Response data:', response.data);
            console.log('🔍 Workflows array:', response.data?.workflows);
            if (response.success) {
                this.workflows = response.data.workflows || [];
                console.log('✅ Loaded workflows:', this.workflows?.length, 'workflows');
                console.log('💾 this.workflows set to:', this.workflows);
            }
        } catch (error) {
            console.error('Error loading workflows:', error);
            this.workflows = [];
        }
    }

    async saveWorkflow(workflowData) {
        try {
            const url = this.editingWorkflowId ? `/api/workflows/${this.editingWorkflowId}` : '/api/workflows';
            const method = this.editingWorkflowId ? 'PUT' : 'POST';
            
            console.log(`🌐 Making API request: ${method} ${this.apiBaseUrl}${url}`);
            console.log('📤 Request data:', workflowData);
            
            const response = await this.apiRequest(url, method, workflowData);
            console.log('📥 API response:', response);
            
            if (response.success) {
                if (this.editingWorkflowId) {
                    const index = this.workflows.findIndex(w => w.id == this.editingWorkflowId);
                    if (index !== -1) {
                        this.workflows[index] = response.data.workflow;
                    }
                } else {
                    // Ensure workflows is an array
                    if (!Array.isArray(this.workflows)) {
                        this.workflows = [];
                    }
                    this.workflows.unshift(response.data.workflow);
                }
                
                this.renderWorkflows();
                this.updateWorkflowStats();
                this.closeWorkflowModal();
                
                return true;
            } else {
                throw new Error(response.message || 'Failed to save workflow');
            }
        } catch (error) {
            console.error('Error saving workflow:', error);
            alert('Failed to save workflow: ' + error.message);
            return false;
        }
    }

    async deleteWorkflow(workflowId) {
        if (!confirm('Are you sure you want to delete this workflow?')) {
            return;
        }

        try {
            const response = await this.apiRequest(`/workflows/${workflowId}`, 'DELETE');
            
            if (response.success) {
                this.workflows = this.workflows.filter(w => w.id != workflowId);
                this.renderWorkflows();
                this.updateWorkflowStats();
            } else {
                throw new Error(response.message || 'Failed to delete workflow');
            }
        } catch (error) {
            console.error('Error deleting workflow:', error);
            alert('Failed to delete workflow: ' + error.message);
        }
    }

    renderWorkflows() {
        const workflowsGrid = document.getElementById('workflowsGrid');
        
        console.log('🎨 Rendering workflows...', this.workflows?.length, 'workflows');
        
        if (!workflowsGrid) {
            console.warn('Workflows grid not found');
            return;
        }

        if (!this.workflows || this.workflows.length === 0) {
            const createButton = this.isAuthenticated 
                ? `<button onclick="openWorkflowModal()" style="margin-top: 20px; padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">
                       <i class="fas fa-plus"></i> Create First Workflow
                   </button>`
                : `<p style="margin-top: 20px; padding: 12px 24px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; color: #6c757d;">
                       <i class="fas fa-info-circle"></i> Login to create workflows
                   </p>`;
            
            workflowsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666;">
                    <i class="fas fa-project-diagram" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3>No workflows yet</h3>
                    <p>Create your first workflow to get started with organizing your processes.</p>
                    ${createButton}
                </div>
            `;
            return;
        }

        workflowsGrid.innerHTML = this.workflows.map(workflow => {
            // Parse tags from JSON string to array with robust error handling
            let tags = [];
            if (workflow.tags !== null && workflow.tags !== undefined) {
                try {
                    if (typeof workflow.tags === 'string') {
                        // Handle JSON string
                        tags = JSON.parse(workflow.tags);
                    } else if (Array.isArray(workflow.tags)) {
                        // Already an array
                        tags = workflow.tags;
                    } else {
                        // Other types, convert to empty array
                        tags = [];
                    }
                } catch (e) {
                    console.warn('Failed to parse workflow tags:', workflow.tags, e);
                    tags = [];
                }
            }
            // Ensure tags is always an array
            workflow.tags = Array.isArray(tags) ? tags : [];
            
            const priorityColors = {
                urgent: '#e74c3c',
                high: '#f39c12',
                medium: '#3498db',
                low: '#95a5a6'
            };

            const statusColors = {
                draft: '#95a5a6',
                active: '#3498db',
                completed: '#27ae60',
                archived: '#7f8c8d'
            };

            const progressPercentage = workflow.steps && workflow.steps.length > 0 
                ? Math.round((workflow.steps.filter(step => step.status === 'completed').length / workflow.steps.length) * 100)
                : 0;

            return `
                <div class="workflow-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.3s; cursor: pointer; border-left: 4px solid ${priorityColors[workflow.priority]};" onclick="showWorkflowDetail(${workflow.id})">
                    <div class="workflow-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #2c3e50; font-size: 18px; line-height: 1.3;">${workflow.title}</h4>
                        ${this.isAuthenticated && this.currentUser?.role === 'admin' ? `
                        <div class="workflow-actions" style="opacity: 0; transition: opacity 0.3s;">
                            <button onclick="event.stopPropagation(); editWorkflow(${workflow.id})" style="background: none; border: none; color: #666; cursor: pointer; padding: 4px; margin-left: 4px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="event.stopPropagation(); deleteWorkflow(${workflow.id})" style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 4px; margin-left: 4px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${workflow.description ? `<p style="color: #666; margin-bottom: 15px; font-size: 14px; line-height: 1.4;">${workflow.description}</p>` : ''}
                    
                    <div class="workflow-meta" style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                        <span style="background: ${statusColors[workflow.status]}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase; font-weight: 500;">${workflow.status}</span>
                        <span style="background: ${priorityColors[workflow.priority]}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase; font-weight: 500;">${workflow.priority}</span>
                        <span style="background: #f8f9fa; color: #666; padding: 3px 8px; border-radius: 12px; font-size: 11px;">${workflow.category}</span>
                    </div>
                    
                    ${workflow.steps && workflow.steps.length > 0 ? `
                        <div class="workflow-progress" style="margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-size: 12px; color: #666;">Progress</span>
                                <span style="font-size: 12px; font-weight: 600; color: #2c3e50;">${progressPercentage}%</span>
                            </div>
                            <div style="background: #ecf0f1; height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: #27ae60; height: 100%; width: ${progressPercentage}%; transition: width 0.3s;"></div>
                            </div>
                            <div style="font-size: 11px; color: #999; margin-top: 3px;">${workflow.steps.filter(s => s.status === 'completed').length} of ${workflow.steps.length} steps completed</div>
                        </div>
                    ` : ''}
                    
                    ${workflow.due_date ? `
                        <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                            <i class="fas fa-calendar"></i> Due: ${new Date(workflow.due_date).toLocaleDateString()}
                        </div>
                    ` : ''}
                    
                    ${workflow.tags && Array.isArray(workflow.tags) && workflow.tags.length > 0 ? `
                        <div class="workflow-tags" style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${workflow.tags.slice(0, 3).map(tag => `<span style="background: #ecf0f1; color: #2c3e50; padding: 2px 6px; border-radius: 10px; font-size: 10px;">${tag}</span>`).join('')}
                            ${workflow.tags.length > 3 ? `<span style="color: #999; font-size: 10px;">+${workflow.tags.length - 3} more</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Add hover effects
        const workflowCards = workflowsGrid.querySelectorAll('.workflow-card');
        workflowCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                const actions = card.querySelector('.workflow-actions');
                if (actions) actions.style.opacity = '1';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                const actions = card.querySelector('.workflow-actions');
                if (actions) actions.style.opacity = '0';
            });
        });
    }

    updateAllWorkflowTags() {
        this.allWorkflowTags.clear();
        this.workflows.forEach(workflow => {
            if (workflow.tags && Array.isArray(workflow.tags)) {
                workflow.tags.forEach(tag => this.allWorkflowTags.add(tag));
            }
        });
    }

    updateWorkflowStats() {
        // Allow public access to workflow stats

        const stats = {
            total: this.workflows.length,
            active: this.workflows.filter(w => w.status === 'active').length,
            completed: this.workflows.filter(w => w.status === 'completed').length,
            overdue: this.workflows.filter(w => w.due_date && new Date(w.due_date) < new Date() && w.status !== 'completed').length
        };

        // Update stats in WorkflowHub intro
        const totalElement = document.getElementById('totalWorkflows');
        const activeElement = document.getElementById('activeWorkflows');
        const completedElement = document.getElementById('completedWorkflows');

        if (totalElement) totalElement.textContent = stats.total;
        if (activeElement) activeElement.textContent = stats.active;
        if (completedElement) completedElement.textContent = stats.completed;
    }

    showWorkflowSection() {
        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show workflow content
        document.getElementById('workflowContent').classList.remove('hidden');
        
        // Update navigation
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('[data-section="workflowhub"]').classList.add('active');

        // Update header
        const header = document.getElementById('mainHeader');
        header.innerHTML = `
            <h2>WorkflowHub</h2>
            <p>Organize and track your workflows and processes</p>
        `;

        this.currentSection = 'workflow';
        
        // Load and render workflows (public access)
        if (this.workflows.length === 0) {
            this.loadWorkflows();
        }
        // Always render workflows when showing workflow section
        console.log('🎨 Rendering workflows in showWorkflowSection...');
        this.renderWorkflows();
        this.updateWorkflowStats();
    }

    openWorkflowModal() {
        if (!this.isAuthenticated) {
            alert('Please login to create workflows.');
            return;
        }

        this.editingWorkflowId = null;
        this.workflowStepCounter = 0;
        document.getElementById('workflowModalTitle').textContent = 'Create New Workflow';
        
        // Reset save button text
        const saveButton = document.querySelector('#workflowForm button[type="submit"]');
        if (saveButton) {
            saveButton.textContent = 'Create Workflow';
        }
        
        document.getElementById('workflowForm').reset();
        document.getElementById('stepsList').innerHTML = '';
        document.getElementById('workflowModal').classList.add('active');
    }

    closeWorkflowModal() {
        document.getElementById('workflowModal').classList.remove('active');
        document.getElementById('workflowForm').reset();
        this.editingWorkflowId = null;
        this.workflowStepCounter = 0;
    }

    addWorkflowStep() {
        const stepsList = document.getElementById('stepsList');
        const stepId = ++this.workflowStepCounter;
        
        const stepDiv = document.createElement('div');
        stepDiv.className = 'workflow-step';
        stepDiv.style.cssText = 'margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: white;';
        
        stepDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>Step ${stepId}</strong>
                <button type="button" onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #e74c3c; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <input type="text" placeholder="Step title" required style="width: 100%; padding: 6px; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 3px;">
            <textarea placeholder="Step description (optional)" style="width: 100%; padding: 6px; height: 60px; border: 1px solid #ddd; border-radius: 3px; resize: vertical;"></textarea>
        `;
        
        stepsList.appendChild(stepDiv);
    }

    async setupWorkflowEventListeners() {
        // Workflow form submission
        const workflowForm = document.getElementById('workflowForm');
        if (workflowForm) {
            workflowForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleWorkflowFormSubmit();
            });
        }

        // Workflow filters
        const statusFilter = document.getElementById('workflowStatusFilter');
        const priorityFilter = document.getElementById('workflowPriorityFilter');
        const searchInput = document.getElementById('workflowSearch');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyWorkflowFilters());
        }
        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => this.applyWorkflowFilters());
        }
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyWorkflowFilters());
        }
    }

    async handleWorkflowFormSubmit() {
        console.log('🔄 Starting workflow form submission...');
        
        const formData = {
            title: document.getElementById('workflowTitle').value.trim(),
            description: document.getElementById('workflowDescription').value.trim(),
            category: document.getElementById('workflowCategory').value,
            priority: document.getElementById('workflowPriority').value,
            due_date: document.getElementById('workflowDueDate').value || null,
            tags: (document.getElementById('workflowTags').value || '').split(',').map(tag => tag.trim()).filter(tag => tag),
            steps: []
        };
        
        console.log('📝 Form data:', formData);

        // Collect workflow steps
        const stepElements = document.querySelectorAll('.workflow-step');
        stepElements.forEach((stepElement, index) => {
            const titleInput = stepElement.querySelector('input[type="text"]');
            const descriptionTextarea = stepElement.querySelector('textarea');
            
            if (titleInput && titleInput.value.trim()) {
                formData.steps.push({
                    title: titleInput.value.trim(),
                    description: descriptionTextarea ? descriptionTextarea.value.trim() : '',
                    step_order: index
                });
            }
        });

        console.log('💾 Calling saveWorkflow...');
        const success = await this.saveWorkflow(formData);
        console.log('✅ saveWorkflow result:', success);
    }

    applyWorkflowFilters() {
        const statusFilter = document.getElementById('workflowStatusFilter')?.value || '';
        const priorityFilter = document.getElementById('workflowPriorityFilter')?.value || '';
        const searchQuery = document.getElementById('workflowSearch')?.value.toLowerCase() || '';

        let filteredWorkflows = [...this.workflows];

        // Apply status filter
        if (statusFilter) {
            filteredWorkflows = filteredWorkflows.filter(w => w.status === statusFilter);
        }

        // Apply priority filter
        if (priorityFilter) {
            filteredWorkflows = filteredWorkflows.filter(w => w.priority === priorityFilter);
        }

        // Apply search filter
        if (searchQuery) {
            filteredWorkflows = filteredWorkflows.filter(w => 
                w.title.toLowerCase().includes(searchQuery) ||
                (w.description && w.description.toLowerCase().includes(searchQuery)) ||
                (w.tags && w.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
            );
        }

        // Temporarily store original workflows and render filtered ones
        const originalWorkflows = this.workflows;
        this.workflows = filteredWorkflows;
        this.renderWorkflows();
        this.workflows = originalWorkflows;
    }

    async editWorkflow(workflowId) {
        try {
            const response = await this.apiRequest(`/api/workflows/${workflowId}`, 'GET');
            if (response.success) {
                const workflow = response.data.workflow;
                
                this.editingWorkflowId = workflowId;
                document.getElementById('workflowModalTitle').textContent = 'Edit Workflow';
                
                // Update save button text
                const saveButton = document.querySelector('#workflowForm button[type="submit"]');
                if (saveButton) {
                    saveButton.textContent = 'Save Changes';
                }
                
                // Populate form fields
                document.getElementById('workflowTitle').value = workflow.title || '';
                document.getElementById('workflowDescription').value = workflow.description || '';
                document.getElementById('workflowCategory').value = workflow.category || 'general';
                document.getElementById('workflowPriority').value = workflow.priority || 'medium';
                document.getElementById('workflowTags').value = (workflow.tags || []).join(', ');
                
                if (workflow.due_date) {
                    const date = new Date(workflow.due_date);
                    document.getElementById('workflowDueDate').value = date.toISOString().slice(0, 16);
                }

                // Populate steps
                const stepsList = document.getElementById('stepsList');
                stepsList.innerHTML = '';
                this.workflowStepCounter = 0;
                
                if (workflow.steps && workflow.steps.length > 0) {
                    workflow.steps.forEach(step => {
                        this.addWorkflowStep();
                        const stepElement = stepsList.lastElementChild;
                        const titleInput = stepElement.querySelector('input[type="text"]');
                        const descriptionTextarea = stepElement.querySelector('textarea');
                        
                        if (titleInput) titleInput.value = step.title || '';
                        if (descriptionTextarea) descriptionTextarea.value = step.description || '';
                    });
                }

                document.getElementById('workflowModal').classList.add('active');
            }
        } catch (error) {
            console.error('Error loading workflow for edit:', error);
            alert('Failed to load workflow for editing');
        }
    }

    async showWorkflowDetail(workflowId) {
        try {
            const response = await this.apiRequest(`/workflows/${workflowId}`, 'GET');
            if (response.success) {
                const workflow = response.data.workflow;
                this.currentWorkflowDetail = workflow;
                
                // Populate modal
                document.getElementById('workflowDetailTitle').textContent = workflow.title;
                document.getElementById('workflowDetailCategory').textContent = workflow.category;
                document.getElementById('workflowDetailPriority').textContent = workflow.priority;
                document.getElementById('workflowDetailStatus').textContent = workflow.status;
                document.getElementById('workflowDetailDate').textContent = new Date(workflow.created_at).toLocaleDateString();
                document.getElementById('workflowDetailDescription').textContent = workflow.description || 'No description provided';
                
                // Render steps
                const stepsContainer = document.getElementById('workflowDetailSteps');
                if (workflow.steps && workflow.steps.length > 0) {
                    stepsContainer.innerHTML = workflow.steps.map((step, index) => `
                        <div style="border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: ${step.status === 'completed' ? '#f8f9fa' : 'white'};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <strong style="color: #2c3e50;">Step ${index + 1}: ${step.title}</strong>
                                <span style="background: ${step.status === 'completed' ? '#27ae60' : step.status === 'in_progress' ? '#f39c12' : '#95a5a6'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; text-transform: uppercase;">
                                    ${step.status}
                                </span>
                            </div>
                            ${step.description ? `<p style="margin: 0; color: #666; font-size: 14px;">${step.description}</p>` : ''}
                        </div>
                    `).join('');
                } else {
                    stepsContainer.innerHTML = '<p style="color: #999; font-style: italic;">No steps defined for this workflow.</p>';
                }
                
                // Render tags
                const tagsContainer = document.getElementById('workflowDetailTags');
                if (workflow.tags && workflow.tags.length > 0) {
                    tagsContainer.innerHTML = workflow.tags.map(tag => 
                        `<span style="background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin-right: 6px; margin-bottom: 6px; display: inline-block;">${tag}</span>`
                    ).join('');
                } else {
                    tagsContainer.innerHTML = '<p style="color: #999; font-style: italic;">No tags</p>';
                }

                // Show/hide edit button based on user role
                const editButton = document.getElementById('editWorkflowBtn');
                if (editButton) {
                    if (this.isAuthenticated && this.currentUser?.role === 'admin') {
                        editButton.style.display = 'inline-flex';
                    } else {
                        editButton.style.display = 'none';
                    }
                }

                document.getElementById('workflowDetailModal').classList.add('active');
            }
        } catch (error) {
            console.error('Error loading workflow detail:', error);
            alert('Failed to load workflow details');
        }
    }

    closeWorkflowDetail() {
        document.getElementById('workflowDetailModal').classList.remove('active');
        this.currentWorkflowDetail = null;
    }

    editWorkflowFromDetail() {
        if (this.currentWorkflowDetail) {
            this.closeWorkflowDetail();
            this.editWorkflow(this.currentWorkflowDetail.id);
        }
    }
}

// Quick Login Functions
function showQuickLogin() {
    document.getElementById('quickLoginModal').classList.add('active');
}

function closeQuickLogin() {
    document.getElementById('quickLoginModal').classList.remove('active');
    document.getElementById('quickLoginForm').reset();
}

async function handleQuickLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('quickEmail').value;
    const password = document.getElementById('quickPassword').value;
    
    console.log('=== QUICK LOGIN DEBUG START ===');
    console.log('Email:', email);
    console.log('Password length:', password.length);
    console.log('PersonalWebsite instance:', window.personalWebsite);
    
    if (!email || !password) {
        console.error('Missing credentials');
        alert('Please enter both email and password');
        return;
    }
    
    try {
        console.log('Calling login method...');
        const result = await window.personalWebsite.login(email, password);
        console.log('Login method returned:', result);
        console.log('Result type:', typeof result);
        console.log('Result success:', result?.success);
        
        if (result && result.success) {
            console.log('SUCCESS: Login worked!');
            console.log('Current user after login:', window.personalWebsite.currentUser);
            console.log('Is authenticated:', window.personalWebsite.isAuthenticated);
            
            closeQuickLogin();
            window.personalWebsite.updateAuthUI();
            
            if (window.personalWebsite.currentUser && window.personalWebsite.currentUser.name) {
                window.personalWebsite.showNotification(`Welcome, ${window.personalWebsite.currentUser.name}!`);
            } else {
                window.personalWebsite.showNotification('Login successful!');
            }
        } else {
            console.error('FAILED: Login returned false/error');
            console.error('Full result object:', result);
            alert(result?.message || 'Login failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('EXCEPTION during login:', error);
        console.error('Error stack:', error.stack);
        alert('Login error: ' + error.message);
    }
    
    console.log('=== QUICK LOGIN DEBUG END ===');
}

// Global functions for inline event handlers
function toggleNavSection() {
    const personalSection = document.getElementById('personalSection');
    const knowledgeSection = document.getElementById('knowledgeSection');
    
    if (personalSection.classList.contains('hidden')) {
        window.personalWebsite.showPersonalSection();
    } else {
        window.personalWebsite.showKnowledgeSection('all');
    }
}

function showSection(sectionId) {
    window.personalWebsite.showPersonalPage(sectionId);
}

function showKnowledgeSection(category) {
    window.personalWebsite.showKnowledgeSection(category);
}

function showWorkflowSection() {
    window.personalWebsite.showWorkflowSection();
}

function openWorkflowModal() {
    window.personalWebsite.openWorkflowModal();
}

function closeWorkflowModal() {
    window.personalWebsite.closeWorkflowModal();
}

function addWorkflowStep() {
    window.personalWebsite.addWorkflowStep();
}

function editWorkflow(workflowId) {
    window.personalWebsite.editWorkflow(workflowId);
}

function deleteWorkflow(workflowId) {
    window.personalWebsite.deleteWorkflow(workflowId);
}

function showWorkflowDetail(workflowId) {
    window.personalWebsite.showWorkflowDetail(workflowId);
}

function closeWorkflowDetail() {
    window.personalWebsite.closeWorkflowDetail();
}

function editWorkflowFromDetail() {
    window.personalWebsite.editWorkflowFromDetail();
}

async function openModal() {
    await window.personalWebsite.openModal();
}

function closeModal() {
    window.personalWebsite.closeModal();
}

async function openEditModal(noteId) {
    await window.personalWebsite.openEditModal(noteId);
}

function deleteNote(noteId) {
    window.personalWebsite.deleteNote(noteId);
}

function duplicateNote(noteId) {
    window.personalWebsite.duplicateNote(noteId);
}

function toggleTagFilter(tag) {
    window.personalWebsite.toggleTagFilter(tag);
}

function exportNotes() {
    window.personalWebsite.exportNotes();
}

function importNotes() {
    window.personalWebsite.importNotes();
}


function continueAsGuest() {
    window.personalWebsite.continueAsGuest();
}

function logout() {
    window.personalWebsite.logout();
}


function showNoteDetail(noteId) {
    window.personalWebsite.showNoteDetail(noteId);
}

function closeNoteDetail() {
    window.personalWebsite.closeNoteDetail();
}

function editFromDetail() {
    window.personalWebsite.editFromDetail();
}

function goToHomepage() {
    window.personalWebsite.goToHomepage();
}

function toggleMobileNav() {
    window.personalWebsite.toggleMobileNav();
}

// Sidebar Categories Functions
function updateSidebarCategories() {
    console.log('updateSidebarCategories called');
    
    // Extract categories from loaded notes (works for both authenticated and public users)
    const notes = window.personalWebsite?.notes || [];
    console.log('Notes available for sidebar categories:', notes.length);
    const categoriesFromNotes = new Set();
    
    notes.forEach(note => {
        if (note.category) {
            categoriesFromNotes.add(note.category);
        }
    });
    
    // Always include predefined categories
    const predefinedCategories = [
        { name: 'ideas', display_name: 'Ideas' },
        { name: 'projects', display_name: 'Projects' },
        { name: 'learning', display_name: 'Learning' },
        { name: 'resources', display_name: 'Resources' }
    ];
    
    // Add any custom categories found in notes
    const customCategories = [];
    categoriesFromNotes.forEach(categoryName => {
        const isPredefined = predefinedCategories.some(cat => cat.name === categoryName);
        if (!isPredefined) {
            customCategories.push({
                name: categoryName,
                display_name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1)
            });
        }
    });
    
    const categoryData = {
        predefined: predefinedCategories,
        custom: customCategories
    };
    
    console.log('Generated categories from notes:', categoryData);
    renderSidebarCategories(categoryData);
}

function renderSidebarCategories(categoryData) {
    console.log('renderSidebarCategories called with:', categoryData);
    const container = document.getElementById('sidebarCategories');
    console.log('Sidebar container found:', container);
    if (!container) {
        console.error('sidebarCategories container not found');
        return;
    }
    
    const notes = window.personalWebsite?.notes || [];
    console.log('Rendering sidebar with notes count:', notes.length);
    
    // Count notes per category
    const categoryCounts = {};
    notes.forEach(note => {
        if (note.category) {
            categoryCounts[note.category] = (categoryCounts[note.category] || 0) + 1;
        }
    });
    
    console.log('Category counts for sidebar:', categoryCounts);
    
    // Get all categories with proper icons and display names
    const predefinedCategories = [
        { name: 'all', displayName: 'All Notes', icon: 'fas fa-th-large', isSpecial: true },
        { name: 'ideas', displayName: 'Ideas', icon: 'fas fa-lightbulb' },
        { name: 'projects', displayName: 'Projects', icon: 'fas fa-code' },
        { name: 'learning', displayName: 'Learning', icon: 'fas fa-graduation-cap' },
        { name: 'resources', displayName: 'Resources', icon: 'fas fa-bookmark' }
    ];
    
    // Get custom categories
    const customCategories = (categoryData.custom || []).map(cat => ({
        name: cat.name,
        displayName: cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1),
        icon: 'fas fa-tag' // Default icon for custom categories
    }));
    
    // Combine all categories
    const allCategories = [...predefinedCategories, ...customCategories];
    console.log('All categories to render:', allCategories);
    
    // Calculate total count for "All Notes"
    const totalNotes = notes.length;
    
    container.innerHTML = allCategories.map(category => {
        const count = category.name === 'all' ? totalNotes : (categoryCounts[category.name] || 0);
        return `
            <div class="category-item" data-category="${category.name}" onclick="showKnowledgeSection('${category.name}')">
                <i class="${category.icon}"></i>
                <span>${category.displayName}</span>
                <span class="count" style="margin-left: auto;">${count}</span>
            </div>
        `;
    }).join('');
}

// Content Import Functions
async function loadCategoriesForImport() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateCategoryDropdowns(result.data);
        }
    } catch (error) {
        console.error('Error loading categories for import:', error);
    }
}

function updateCategoryDropdowns(categoryData) {
    // Get predefined categories with proper display names
    const predefinedCategories = [
        { name: 'ideas', displayName: 'Ideas' },
        { name: 'projects', displayName: 'Projects' },
        { name: 'learning', displayName: 'Learning' },
        { name: 'resources', displayName: 'Resources' }
    ];
    
    // Get custom categories
    const customCategories = (categoryData.custom || []).map(cat => ({
        name: cat.name,
        displayName: cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
    }));
    
    // Combine all categories
    const allCategories = [...predefinedCategories, ...customCategories];
    
    // Update all category dropdowns
    const dropdownIds = ['captureCategory', 'rssCategory', 'newCategorySelect'];
    
    dropdownIds.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            // Store current selection
            const currentValue = dropdown.value;
            
            // Clear existing options
            dropdown.innerHTML = '';
            
            // Add all categories as options
            allCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.displayName;
                dropdown.appendChild(option);
            });
            
            // Restore selection if it still exists
            if (currentValue && allCategories.some(cat => cat.name === currentValue)) {
                dropdown.value = currentValue;
            } else {
                // Default to first option
                dropdown.selectedIndex = 0;
            }
        }
    });
}

function openContentModal() {
    document.getElementById('contentModal').style.display = 'block';
    // Reset to first tab
    const tabs = document.querySelectorAll('.content-tab');
    const tabContents = document.querySelectorAll('.content-tab-panel');
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    tabs[0].classList.add('active');
    document.getElementById('quick-panel').classList.add('active');
    loadRSSources(); // Load RSS sources when modal opens
    loadCategoriesForImport();
        updateSidebarCategories(); // Load categories for dropdowns
}

function closeContentModal() {
    document.getElementById('contentModal').style.display = 'none';
    // Clear forms
    document.getElementById('quickCaptureForm').reset();
    document.getElementById('rssForm').reset();
}

function switchContentTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.content-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const tabContents = document.querySelectorAll('.content-tab-panel');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Show selected tab
    event.target.classList.add('active');
    document.getElementById(tabName + '-panel').classList.add('active');
}

async function submitQuickCapture() {
    const form = document.getElementById('quickCaptureForm');
    
    const captureData = {
        url: document.getElementById('captureUrl').value,
        title: document.getElementById('captureTitle').value,
        content: document.getElementById('captureContent').value,
        category: document.getElementById('captureCategory').value,
        tags: document.getElementById('captureTags') ? document.getElementById('captureTags').value.split(',').map(tag => tag.trim()) : []
    };
    
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/quick-capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            },
            body: JSON.stringify(captureData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Content captured successfully!');
            closeContentModal();
            // Refresh notes
            window.personalWebsite.renderNotes();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error capturing content:', error);
        alert('Failed to capture content. Please try again.');
    }
}

async function loadRSSources() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/rss-sources`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayRSSources(result.data.sources);
        } else {
            console.error('Failed to load RSS sources:', result.message);
        }
    } catch (error) {
        console.error('Error loading RSS sources:', error);
    }
}

function displayRSSources(sources) {
    const container = document.getElementById('rssSourcesList');
    
    if (sources.length === 0) {
        container.innerHTML = '<p>No RSS sources added yet. Add your first source above!</p>';
        return;
    }
    
    container.innerHTML = sources.map(source => `
        <div class="rss-source-item">
            <div class="rss-source-info">
                <h4>${source.name}</h4>
                <p><strong>URL:</strong> ${source.url}</p>
                <p><strong>Category:</strong> ${source.category}</p>
                <p><strong>Last Fetched:</strong> ${source.last_fetched ? new Date(source.last_fetched).toLocaleDateString() : 'Never'}</p>
            </div>
            <div class="rss-source-actions">
                <button onclick="fetchRSSContent(${source.id})" class="btn btn-primary">Fetch Content</button>
                <button onclick="deleteRSSSource(${source.id})" class="btn btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

async function addRSSSource() {
    const form = document.getElementById('rssForm');
    const formData = new FormData(form);
    
    const sourceData = {
        name: document.getElementById('rssName').value,
        url: document.getElementById('rssUrl').value,
        category: document.getElementById('rssCategory').value
    };
    
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/rss-sources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            },
            body: JSON.stringify(sourceData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('RSS source added successfully!');
            form.reset();
            loadRSSources(); // Reload the list
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error adding RSS source:', error);
        alert('Failed to add RSS source. Please try again.');
    }
}

async function fetchRSSContent(sourceId) {
    try {
        const limit = document.getElementById('defaultRssLimit')?.value || 10;
        const response = await fetch(`${this.apiBaseUrl}/content/fetch-rss/${sourceId}?limit=${limit}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`${result.data.message}`);
            // Refresh notes to show imported content
            window.personalWebsite.renderNotes();
            loadRSSources(); // Update last fetched time
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error fetching RSS content:', error);
        alert('Failed to fetch RSS content. Please try again.');
    }
}

async function deleteRSSSource(sourceId) {
    if (!confirm('Are you sure you want to delete this RSS source?')) {
        return;
    }
    
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/rss-sources/${sourceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('RSS source deleted successfully!');
            loadRSSources(); // Reload the list
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting RSS source:', error);
        alert('Failed to delete RSS source. Please try again.');
    }
}

async function loadContentTemplates() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/templates`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayContentTemplates(result.data.templates);
        } else {
            console.error('Failed to load templates:', result.message);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function displayContentTemplates(templates) {
    const container = document.getElementById('templatesList');
    
    container.innerHTML = Object.entries(templates).map(([key, template]) => `
        <div class="template-item">
            <h4>${key.replace('-', ' ').toUpperCase()}</h4>
            <p><strong>Category:</strong> ${template.category}</p>
            <p><strong>Tags:</strong> ${template.tags.join(', ')}</p>
            <button onclick="useTemplate('${key}')" class="btn btn-primary">Use Template</button>
            <details>
                <summary>Preview</summary>
                <pre>${template.content}</pre>
            </details>
        </div>
    `).join('');
}

function useTemplate(templateKey) {
    // Switch to quick capture tab and populate with template
    const tabs = document.querySelectorAll('.content-tab');
    const tabContents = document.querySelectorAll('.content-tab-panel');
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    tabs[0].classList.add('active');
    document.getElementById('quick-panel').classList.add('active');
    
    // Load template data
    fetch(`${this.apiBaseUrl}/content/templates`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            const template = result.data.templates[templateKey];
            document.getElementById('captureTitle').value = template.title;
            document.getElementById('captureContent').value = template.content;
            document.getElementById('captureCategory').value = template.category;
            document.getElementById('captureTags').value = template.tags.join(', ');
        }
    });
}

// Category Management Functions
async function loadCategoryManagement() {
    await loadCategories();
    await loadNotesForCategoryUpdate();
    await loadCategoriesForBulkUpdate();
}


let allNotesForBulkUpdate = []; // Store all notes for filtering
let filteredNotesForBulkUpdate = []; // Store filtered notes

async function loadNotesForCategoryUpdate() {
    try {
        // Fetch notes directly from API to ensure fresh data
        const response = await fetch(`${this.apiBaseUrl}/notes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        allNotesForBulkUpdate = result.success ? result.data.notes : [];
        filteredNotesForBulkUpdate = [...allNotesForBulkUpdate];
        
        // Setup search and filter event listeners
        setupBulkUpdateControls();
        
        // Load category filter options
        await loadCategoryFilterOptions();
        
        // Initial render
        renderFilteredNotes();
        
        console.log(`Loaded ${allNotesForBulkUpdate.length} notes for bulk category update`);
    } catch (error) {
        console.error('Error loading notes for category update:', error);
        const container = document.getElementById('notesSelector');
        if (container) {
            container.innerHTML = '<p class="error">Failed to load notes. Please try again.</p>';
        }
    }
}

function setupBulkUpdateControls() {
    const searchInput = document.getElementById('notesSearchInput');
    const categoryFilter = document.getElementById('notesCategoryFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterNotes);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterNotes);
    }
}

async function loadCategoryFilterOptions() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById('notesCategoryFilter');
            if (!select) return;
            
            // Clear existing options except "All Categories"
            select.innerHTML = '<option value="">All Categories</option>';
            
            // Add predefined categories
            const predefinedCategories = ['ideas', 'projects', 'learning', 'resources'];
            predefinedCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
                select.appendChild(option);
            });
            
            // Add custom categories
            const customCategories = result.data.custom || [];
            customCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading category filter options:', error);
    }
}

function filterNotes() {
    const searchQuery = document.getElementById('notesSearchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('notesCategoryFilter').value;
    
    filteredNotesForBulkUpdate = allNotesForBulkUpdate.filter(note => {
        // Search filter
        const matchesSearch = !searchQuery || 
            note.title.toLowerCase().includes(searchQuery) ||
            note.content.toLowerCase().includes(searchQuery);
        
        // Category filter
        const matchesCategory = !categoryFilter || note.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    renderFilteredNotes();
}

function renderFilteredNotes() {
    const container = document.getElementById('notesSelector');
    
    if (!container) {
        console.error('notesSelector container not found');
        return;
    }
    
    if (filteredNotesForBulkUpdate.length === 0) {
        container.innerHTML = '<p class="no-notes">No notes match your search criteria.</p>';
        updateSelectedCount();
        return;
    }
    
    container.innerHTML = filteredNotesForBulkUpdate.map(note => `
        <div class="note-checkbox-item">
            <input type="checkbox" id="note-${note.id}" value="${note.id}" onchange="updateSelectedCount()">
            <label for="note-${note.id}">
                <span class="note-title" title="${note.title}">${note.title}</span>
                <span class="note-category-badge">${note.category}</span>
            </label>
        </div>
    `).join('');
    
    updateSelectedCount();
}

function selectAllNotes() {
    const checkboxes = document.querySelectorAll('#notesSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectedCount();
}

function selectNoneNotes() {
    const checkboxes = document.querySelectorAll('#notesSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('#notesSelector input[type="checkbox"]:checked');
    const count = checkboxes.length;
    const countElement = document.getElementById('selectedNotesCount');
    if (countElement) {
        countElement.textContent = `${count} selected`;
    }
}

async function loadCategoriesForBulkUpdate() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBulkCategoryDropdown(result.data);
        }
    } catch (error) {
        console.error('Error loading categories for bulk update:', error);
    }
}

function updateBulkCategoryDropdown(categoryData) {
    const select = document.getElementById('newCategorySelect');
    if (!select) return;
    
    // Get predefined categories
    const predefinedCategories = [
        { name: 'ideas', displayName: 'Ideas' },
        { name: 'projects', displayName: 'Projects' },
        { name: 'learning', displayName: 'Learning' },
        { name: 'resources', displayName: 'Resources' }
    ];
    
    // Get custom categories
    const customCategories = (categoryData.custom || []).map(cat => ({
        name: cat.name,
        displayName: cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
    }));
    
    // Store current value
    const currentValue = select.value;
    
    // Clear and repopulate
    select.innerHTML = '';
    
    // Add all categories
    [...predefinedCategories, ...customCategories].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.displayName;
        select.appendChild(option);
    });
    
    // Restore selection or set default
    if (currentValue) {
        select.value = currentValue;
    } else if (select.options.length > 0) {
        select.selectedIndex = 0;
    }
}

async function updateSelectedCategories() {
    const checkboxes = document.querySelectorAll('#notesSelector input[type="checkbox"]:checked');
    const noteIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const newCategory = document.getElementById('newCategorySelect').value;
    
    if (noteIds.length === 0) {
        alert('Please select at least one note to update.');
        return;
    }
    
    if (!confirm(`Update ${noteIds.length} notes to category "${newCategory}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories/bulk-update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            },
            body: JSON.stringify({
                noteIds,
                newCategory
            })
        });
        
        const result = await response.json();
        console.log('Bulk update response:', result);
        
        if (result.success) {
            alert(result.data.message);
            // Refresh the notes and category management
            try {
                window.personalWebsite.renderNotes();
                window.personalWebsite.updateCategoryCounts();
                updateSidebarCategories();
                await loadCategoryManagement();
            } catch (refreshError) {
                console.error('Error during post-bulk-update refresh:', refreshError);
                alert('Bulk update completed but there was an error refreshing the interface: ' + refreshError.message);
            }
        } else {
            console.error('Bulk update failed:', result);
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error updating categories:', error);
        alert('Failed to update categories. Please try again.');
    }
}

// Category Management Functions
let editingCategoryName = null;

async function showCategoryManagement() {
    // Check if user has admin privileges
    const website = window.personalWebsite || new PersonalWebsite();
    
    if (!website.currentUser || website.currentUser.role !== 'admin' || website.currentUser.isGuest) {
        alert('Category management is restricted to administrators only. Contact your administrator for access.');
        return;
    }
    
    document.getElementById('categoryManagementModal').style.display = 'block';
    await loadCategoryManagement();
}

function closeCategoryManagement() {
    document.getElementById('categoryManagementModal').style.display = 'none';
    resetCategoryForm();
}

function resetCategoryForm() {
    document.getElementById('categoryForm').reset();
    editingCategoryName = null;
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.querySelector('#categoryForm button[onclick="saveCategory()"]').innerHTML = '<i class="fas fa-plus"></i> Add Category';
    // Remove editing class from all cards
    document.querySelectorAll('.category-card').forEach(card => card.classList.remove('category-editing'));
}

async function loadCategories() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            await displayCategories(result.data);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadCategoriesForNoteForm() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateNoteCategoryDropdown(result.data);
        }
    } catch (error) {
        console.error('Error loading categories for note form:', error);
    }
}

function updateNoteCategoryDropdown(categoryData) {
    const select = document.getElementById('noteCategory');
    if (!select) return;
    
    // Get predefined categories
    const predefinedCategories = [
        { name: 'ideas', displayName: 'Ideas' },
        { name: 'projects', displayName: 'Projects' },
        { name: 'learning', displayName: 'Learning' },
        { name: 'resources', displayName: 'Resources' }
    ];
    
    // Get custom categories
    const customCategories = (categoryData.custom || []).map(cat => ({
        name: cat.name,
        displayName: cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
    }));
    
    // Store current value
    const currentValue = select.value;
    
    // Clear and repopulate
    select.innerHTML = '';
    
    // Add all categories
    [...predefinedCategories, ...customCategories].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.displayName;
        select.appendChild(option);
    });
    
    // Restore selection or set default
    if (currentValue) {
        select.value = currentValue;
    } else if (select.options.length > 0) {
        // Set default to first option if no current value
        select.selectedIndex = 0;
    }
}

async function displayCategories(categoryData) {
    const container = document.getElementById('categoriesList');
    const notes = window.personalWebsite?.notes || [];
    
    // Count notes per category
    const categoryCounts = {};
    notes.forEach(note => {
        categoryCounts[note.category] = (categoryCounts[note.category] || 0) + 1;
    });
    
    // Get the data structure from the API response
    const customCategories = categoryData.custom || [];
    
    const predefinedCategories = [
        { name: 'ideas', displayName: 'Ideas', description: 'Creative ideas and inspirations' },
        { name: 'projects', displayName: 'Projects', description: 'Current and future projects' },
        { name: 'learning', displayName: 'Learning', description: 'Educational content and resources' },
        { name: 'resources', displayName: 'Resources', description: 'Useful tools and references' }
    ];
    
    const allCategories = [
        ...predefinedCategories.map(cat => ({ ...cat, isPredefined: true })),
        ...customCategories.map(cat => ({ 
            name: cat.name, 
            displayName: cat.display_name || cat.name.charAt(0).toUpperCase() + cat.name.slice(1), 
            description: cat.description || 'Custom category',
            isPredefined: false 
        }))
    ];
    
    container.innerHTML = allCategories.map(category => `
        <div class="category-card" data-category="${category.name}">
            <div class="category-card-header">
                <div class="category-card-title">
                    ${category.displayName}
                    ${category.isPredefined ? '<span class="predefined-badge">Built-in</span>' : ''}
                </div>
                <span class="category-card-id">${category.name}</span>
            </div>
            <div class="category-card-description">
                ${category.description || 'No description'}
            </div>
            <div class="category-card-stats">
                <span class="category-note-count">
                    <i class="fas fa-sticky-note"></i> ${categoryCounts[category.name] || 0} notes
                </span>
            </div>
            <div class="category-card-actions">
                ${!category.isPredefined ? `
                    <button class="btn btn-sm btn-edit" onclick="editCategory('${category.name}', '${category.displayName}', '${category.description || ''}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteCategory('${category.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : `
                    <span style="color: #666; font-size: 12px;">Built-in category</span>
                `}
            </div>
        </div>
    `).join('');
}

async function saveCategory() {
    const name = document.getElementById('categoryName').value.toLowerCase().replace(/\s+/g, '-');
    const displayName = document.getElementById('categoryDisplayName').value;
    const description = document.getElementById('categoryDescription').value;
    
    console.log('Saving category with:', { name, displayName, description, editingCategoryName });
    
    if (!name || !displayName) {
        alert('Please fill in the required fields.');
        return;
    }
    
    try {
        const url = editingCategoryName 
            ? `${this.apiBaseUrl}/content/categories/${editingCategoryName}`
            : `${this.apiBaseUrl}/content/categories`;
        
        const method = editingCategoryName ? 'PUT' : 'POST';
        const body = editingCategoryName 
            ? { displayName, description }
            : { name, displayName, description };
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.data.message);
            resetCategoryForm();
            loadCategories();
            // Refresh the main categories list
            window.personalWebsite.updateCategoryCounts();
            // Update import module dropdowns
            loadCategoriesForImport();
        updateSidebarCategories();
            // Update sidebar categories
            updateSidebarCategories();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving category:', error);
        alert('Failed to save category. Please try again.');
    }
}

function editCategory(name, displayName, description) {
    editingCategoryName = name;
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryName').disabled = true;
    document.getElementById('categoryDisplayName').value = displayName;
    document.getElementById('categoryDescription').value = description;
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.querySelector('#categoryForm button[onclick="saveCategory()"]').innerHTML = '<i class="fas fa-save"></i> Update Category';
    
    // Highlight the card being edited
    document.querySelectorAll('.category-card').forEach(card => card.classList.remove('category-editing'));
    document.querySelector(`[data-category="${name}"]`).classList.add('category-editing');
    
    // Scroll to form
    document.querySelector('.category-form-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelCategoryEdit() {
    resetCategoryForm();
    document.getElementById('categoryName').disabled = false;
}

async function deleteCategory(name) {
    if (!confirm(`Are you sure you want to delete the category "${name}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${this.apiBaseUrl}/content/categories/${name}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('knowledgehub_auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.data.message);
            loadCategories();
            // Refresh the main categories list
            window.personalWebsite.updateCategoryCounts();
            // Update import module dropdowns
            loadCategoriesForImport();
        updateSidebarCategories();
            // Update sidebar categories
            updateSidebarCategories();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category. Please try again.');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.personalWebsite = new PersonalWebsite();
    
    // Load templates when the templates tab is first shown
    document.addEventListener('click', (e) => {
        if (e.target.matches('.content-tab[data-tab="templates"]')) {
            loadContentTemplates();
        }
    });
    
    // Load categories for import dropdowns on app start
    if (window.personalWebsite.isAuthenticated) {
        loadCategoriesForImport();
        updateSidebarCategories();
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('contentModal');
        if (e.target === modal) {
            closeContentModal();
        }
    });
});


// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// RSS Management Functions
let rssFeeds = []; // Store RSS feeds

function showRSSManagement() {
    document.getElementById('rssManagementModal').classList.add('active');
    loadRSSFeeds();
}

function closeRSSManagement() {
    document.getElementById('rssManagementModal').classList.remove('active');
}

async function addRSSFeed() {
    const urlInput = document.getElementById('rssUrl');
    const nameInput = document.getElementById('rssName');
    
    const url = urlInput.value.trim();
    const name = nameInput.value.trim() || extractFeedName(url);
    
    if (!url) {
        showRSSStatus('Please enter a valid RSS feed URL', 'error');
        return;
    }
    
    if (!isValidURL(url)) {
        showRSSStatus('Please enter a valid URL format', 'error');
        return;
    }
    
    try {
        showRSSStatus('Validating RSS feed...', 'info');
        
        // Validate RSS feed (simple check for now)
        const feedData = {
            id: Date.now(),
            url: url,
            name: name,
            dateAdded: new Date().toISOString(),
            status: 'active',
            lastImported: null
        };
        
        // Add to local storage
        rssFeeds.push(feedData);
        localStorage.setItem('rss_feeds', JSON.stringify(rssFeeds));
        
        // Clear inputs
        urlInput.value = '';
        nameInput.value = '';
        
        // Refresh the feeds list
        displayRSSFeeds();
        showRSSStatus(`Successfully added RSS feed: ${name}`, 'success');
        
    } catch (error) {
        console.error('Error adding RSS feed:', error);
        showRSSStatus('Failed to add RSS feed. Please check the URL and try again.', 'error');
    }
}

function loadRSSFeeds() {
    const savedFeeds = localStorage.getItem('rss_feeds');
    rssFeeds = savedFeeds ? JSON.parse(savedFeeds) : [];
    displayRSSFeeds();
}

function displayRSSFeeds() {
    const feedsList = document.getElementById('rssFeedsList');
    
    if (rssFeeds.length === 0) {
        feedsList.innerHTML = '<div class="rss-status info">No RSS feeds added yet. Add your first feed above!</div>';
        return;
    }
    
    feedsList.innerHTML = rssFeeds.map(feed => `
        <div class="rss-feed-item" data-feed-id="${feed.id}">
            <div class="rss-feed-info">
                <div class="rss-feed-name">${feed.name}</div>
                <div class="rss-feed-url">${feed.url}</div>
                <small style="color: #999;">Added: ${new Date(feed.dateAdded).toLocaleDateString()}</small>
            </div>
            <div class="rss-feed-actions">
                <button class="rss-import-btn" onclick="importSingleRSSFeed(${feed.id})" title="Import this feed">
                    <i class="fas fa-download"></i> Import
                </button>
                <button class="rss-delete-btn" onclick="deleteRSSFeed(${feed.id})" title="Delete this feed">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function importSingleRSSFeed(feedId) {
    const feed = rssFeeds.find(f => f.id === feedId);
    if (!feed) return;
    
    try {
        showRSSStatus(`Importing from ${feed.name}...`, 'info');
        
        // Simulate RSS import (in a real app, you'd parse the RSS feed)
        await simulateRSSImport(feed);
        
        // Update last imported date
        feed.lastImported = new Date().toISOString();
        localStorage.setItem('rss_feeds', JSON.stringify(rssFeeds));
        
        displayRSSFeeds();
        showRSSStatus(`Successfully imported content from ${feed.name}`, 'success');
        
    } catch (error) {
        console.error('Error importing RSS feed:', error);
        showRSSStatus(`Failed to import from ${feed.name}`, 'error');
    }
}

async function simulateRSSImport(feed) {
    // Simulate importing RSS content as notes
    const sampleContent = {
        title: `Latest from ${feed.name}`,
        category: 'rss-import',
        content: `Content imported from RSS feed: ${feed.url}\n\nThis is a sample RSS import. In a real implementation, this would parse the RSS XML and extract actual articles.`,
        tags: ['rss', 'auto-import', feed.name.toLowerCase().replace(/\s+/g, '-')]
    };
    
    // Add the sample content to notes using the existing method
    if (window.personalWebsite && window.personalWebsite.saveNote) {
        await window.personalWebsite.saveNote(sampleContent);
    }
}

function deleteRSSFeed(feedId) {
    const feed = rssFeeds.find(f => f.id === feedId);
    if (!feed) return;
    
    if (confirm(`Are you sure you want to delete the RSS feed "${feed.name}"?`)) {
        rssFeeds = rssFeeds.filter(f => f.id !== feedId);
        localStorage.setItem('rss_feeds', JSON.stringify(rssFeeds));
        displayRSSFeeds();
        showRSSStatus(`Deleted RSS feed: ${feed.name}`, 'success');
    }
}

async function importAllRSSFeeds() {
    if (rssFeeds.length === 0) {
        showRSSStatus('No RSS feeds to import', 'info');
        return;
    }
    
    try {
        showRSSStatus('Importing all RSS feeds...', 'info');
        
        for (const feed of rssFeeds) {
            await simulateRSSImport(feed);
            feed.lastImported = new Date().toISOString();
        }
        
        localStorage.setItem('rss_feeds', JSON.stringify(rssFeeds));
        displayRSSFeeds();
        showRSSStatus(`Successfully imported all ${rssFeeds.length} RSS feeds`, 'success');
        
        // Refresh notes display if on knowledge section
        if (window.personalWebsite) {
            window.personalWebsite.loadUserNotes();
            window.personalWebsite.renderNotes();
        }
        
    } catch (error) {
        console.error('Error importing all RSS feeds:', error);
        showRSSStatus('Failed to import some RSS feeds', 'error');
    }
}

function scheduleRSSImport() {
    showRSSStatus('RSS import scheduling is not yet implemented. Coming soon!', 'info');
}

function clearRSSFeeds() {
    if (rssFeeds.length === 0) {
        showRSSStatus('No RSS feeds to clear', 'info');
        return;
    }
    
    if (confirm(`Are you sure you want to delete all ${rssFeeds.length} RSS feeds? This action cannot be undone.`)) {
        rssFeeds = [];
        localStorage.removeItem('rss_feeds');
        displayRSSFeeds();
        showRSSStatus('All RSS feeds have been cleared', 'success');
    }
}

function showRSSStatus(message, type = 'info') {
    const statusDiv = document.createElement('div');
    statusDiv.className = `rss-status ${type}`;
    statusDiv.textContent = message;
    
    // Remove existing status messages
    const existingStatus = document.querySelector('.rss-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Add new status message
    const rssContent = document.querySelector('.rss-management-content');
    if (rssContent) {
        rssContent.appendChild(statusDiv);
        
        // Auto-remove after 5 seconds for success/info messages
        if (type !== 'error') {
            setTimeout(() => {
                statusDiv.remove();
            }, 5000);
        }
    }
}

function extractFeedName(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '').split('.')[0];
    } catch {
        return 'RSS Feed';
    }
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}