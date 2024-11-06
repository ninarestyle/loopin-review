import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface ModalProps {
  onClose: () => void;
}

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)' // Darker background to focus on the modal
  }}>
    <div style={{
      padding: '20px',
      background: '#FFF', // White background to keep it clean and simple
      borderRadius: '10px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.25)', // Softer shadow for a modern look
      zIndex: 1000,
      textAlign: 'center', // Ensure text and contents are centered
      width: '300px' // Fixed width for the modal
    }}>
      <p style={{
        fontSize: '12px', // Reduced font size from 24px to 20px for better fitting
        fontWeight: 'bold', // Bold for emphasis
        margin: '20px 0' // Sufficient margin around the text
      }}>
        Please log in first.
      </p>
      <button onClick={onClose} style={{
        padding: '10px 20px',
        backgroundColor: '#BDEF51', // Brand color for consistency
        border: 'none',
        color: 'black', // Changed font color to black for better visibility
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold', // Bold for emphasis
        fontSize: '11px' // Ensuring the button text is also clearly visible
      }}>
        OK
      </button>
    </div>
  </div>
);


const Popup = () => {
  const [currentURL, setCurrentURL] = useState<string>("");
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        setCurrentURL(tabs[0].url);
      } else {
        setCurrentURL('No active tab');
      }
    });
  }, []);

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
  };

  function adjustImageToAspectRatio(imageSrc: string, backgroundColor: string = 'white', scale: number = 0.5): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get 2D context from canvas"));
          return;
        }

        // Set the canvas size based on the original image size
        canvas.width = img.width;
        canvas.height = img.height;

        // Calculate the scaled dimensions
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Calculate position to center the scaled image on the original size canvas
        const xOffset = (canvas.width - scaledWidth) / 2;
        const yOffset = (canvas.height - scaledHeight) / 2;

        // Fill the background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image scaled in the center of the canvas
        ctx.drawImage(img, xOffset, yOffset, scaledWidth, scaledHeight);

        // Create the final scaled canvas
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
          reject(new Error("Failed to get final 2D context from canvas"));
          return;
        }

        // Set final canvas size
        finalCanvas.width = scaledWidth;
        finalCanvas.height = scaledHeight;

        // Draw the original canvas content resized
        finalCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

        finalCanvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, 'image/png');
      };

      img.onerror = (e) => reject(e);
      img.src = imageSrc;
    });
  }

  const isAuthenticated = async () => {
    return new Promise<boolean>((resolve) => {
      chrome.storage.local.get(['jwtToken'], (result) => {
        resolve(Boolean(result.jwtToken));
      });
    });
  };

  const handleLogin = () => {
    chrome.runtime.sendMessage({ action: "login" }, (response) => {
      console.log(response.status);  // Optional: Handle the response further if needed.
    });
  };

  const requestReview = async (url: string) => {
    if (!(await isAuthenticated())) {
      setShowLoginModal(true); // Show the custom login modal instead of alert
      handleLogin();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const result = await chrome.storage.local.get('jwtToken');
      const jwtToken = result?.jwtToken;

      if (tab) {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, async (imageSrc) => {
          try {
            // Adjust image to 4:3 aspect ratio and convert to blob
            const imageBlob = await adjustImageToAspectRatio(imageSrc);
            // const imageBlob = dataURLtoBlob(imageSrc);
            const file = new File([imageBlob], "screenshot.png", { type: 'image/png' });
            const formData = new FormData();
            formData.append("files", file);

            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/media/upload-media-files`, {
              method: "POST",
              body: formData,
              headers: {
                Authorization: `Bearer ${jwtToken}`,
              },
            });

            if (!uploadResponse.ok) throw new Error("Failed to upload screenshot");

            const uploadDataResponse = await uploadResponse.json();
            const data = uploadDataResponse?.data;
            const mediaUrls = data.payload?.urls;

            const userPostResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/posts/create`, {
              method: 'POST',
              body: JSON.stringify({
                type: 3,
                mediaUrls: mediaUrls,
                content: `Has anyone here purchased this before? ${url}  I'd love to hear about your experience and how you liked it!`,
                title: "Seeking Insights!"
              }),
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`
              }
            });

            if (!userPostResponse.ok) throw new Error("Failed to create user post");

            setModalOpen(true); // Show the modal on success
          } catch (error) {
            console.error("Error in processing:", error);
          }
        });
      }
    });

  };

  const handleModalClose = () => {
    setModalOpen(false); // Hide the modal
  };

  // Inline Modal Component
  const Modal: React.FC<ModalProps> = ({ onClose }) => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)' // Semi-transparent background to focus attention on modal
    }}>
      <div style={{
        padding: '20px',
        background: '#FFF', // White background for clarity
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.5)', // Shadow for depth
        zIndex: 1000,
        textAlign: 'center', // Center-align all text within the modal
      }}>
        <p style={{
          margin: '0 0 20px 0', // Adjusted margin for better spacing
          fontSize: '12px', // Optional font size adjustment for better legibility
          fontWeight: 'bold', // Bold text for emphasis
        }}>
          Post shared successfully!
        </p>
        <button onClick={onClose} style={{
          padding: '10px 20px',
          backgroundColor: '#BDEF51', // Brand color
          border: 'none',
          color: 'black', // Changed text color to black for visibility
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold', // Bold font for button text
          fontSize: '11px' // Ensuring the button text is also clearly visible
        }}>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => requestReview(currentURL)}
        style={{
          backgroundColor: "#BDEF51",
          color: "#000000",
          margin: "10px",
          padding: "10px 20px",
          border: "none",
          borderRadius: "20px",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: "bold",
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'  // Subtle shadow for depth
        }}
      >
        Ask the Community
      </button>
      {isModalOpen && <Modal onClose={handleModalClose} />}
      {showLoginModal && <LoginModal onClose={handleCloseLoginModal} />}
    </>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}
