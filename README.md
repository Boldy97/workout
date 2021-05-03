# workout

A simple application that tracks reps, and assigns points if someone else did not complete a rep in an certain interval.
Please do not judge the code quality. Thank you.

# Usage

There has to be a `data` folder in the root directory of this project.

`$ npm install`

`$ node index.js`
`$ node index.js --interval 10`

# Flags

`port` : default 3000 : the port
`interval` : default 60 : how long until an extra point is assigned (in minutes)
`delay` : default 15 : how long the same person has to wait to get another point for consecutive reps
