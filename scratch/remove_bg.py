import sys
from PIL import Image

def remove_background(img_path, out_path, fuzz=20):
    img = Image.open(img_path).convert("RGBA")
    data = img.getdata()
    bg_color = data[0] # assume top-left pixel is the background color
    
    new_data = []
    for item in data:
        # Check if color is close to bg_color
        if abs(item[0] - bg_color[0]) < fuzz and abs(item[1] - bg_color[1]) < fuzz and abs(item[2] - bg_color[2]) < fuzz:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    img.save(out_path, "PNG")

if __name__ == "__main__":
    remove_background(sys.argv[1], sys.argv[2])
