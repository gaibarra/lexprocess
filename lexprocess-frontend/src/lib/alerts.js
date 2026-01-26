import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/**
 * Utilidad para mostrar alertas premium con SweetAlert2
 */
export const alerts = {
    success: (title, text) => {
        return MySwal.fire({
            icon: 'success',
            title: title || '¡Éxito!',
            text: text,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            customClass: {
                popup: 'premium-swal-toast'
            }
        });
    },

    error: (title, text, footer) => {
        return MySwal.fire({
            icon: 'error',
            title: title || 'Ups...',
            text: text || 'Algo salió mal.',
            footer: footer,
            confirmButtonColor: '#4f46e5', // indigo-600
        });
    },

    info: (title, text) => {
        return MySwal.fire({
            icon: 'info',
            title: title,
            text: text,
            confirmButtonColor: '#4f46e5',
        });
    },

    warning: (title, text) => {
        return MySwal.fire({
            icon: 'warning',
            title: title,
            text: text,
            confirmButtonColor: '#4f46e5',
        });
    },

    confirm: (title, text, confirmText = 'Sí, continuar', cancelText = 'Cancelar') => {
        return MySwal.fire({
            title: title,
            text: text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#ef4444',
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            reverseButtons: true
        });
    },

    loading: (title, text) => {
        return MySwal.fire({
            title: title || 'Procesando...',
            text: text || 'Por favor espera.',
            allowOutsideClick: false,
            didOpen: () => {
                MySwal.showLoading();
            }
        });
    }
};

export default alerts;
